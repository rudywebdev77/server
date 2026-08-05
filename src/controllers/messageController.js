import Message from '../models/Message.js';
import File from '../models/File.js';
import Project from '../models/Project.js';
import { logActivity } from '../utils/logActivity.js';
import { createNotification } from '../utils/createNotification.js';
import { broadcastToProject } from '../websocket/websocket.js';
import { uploadFileToCloud } from '../utils/uploadCloud.js';

// @desc    Send message
export const sendMessage = async (req, res, next) => {
  try {
    // Admin read-only protection
    if (req.user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Administrators have read-only access and cannot send messages.',
      });
    }

    const { projectId, receiverId, message, replyTo, voiceDuration } = req.body;


    const attachmentIds = [];
    let attachmentPath = '';
    let attachmentName = '';
    let attachmentType = '';
    let attachmentSize = 0;
    let mimeType = '';
    let voiceUrl = '';

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const cloudUrl = await uploadFileToCloud(file);

        const fileDoc = await File.create({
          project: projectId,
          uploadedBy: req.user._id,
          fileName: file.filename,
          originalName: file.originalname,
          filePath: cloudUrl,
          fileType: file.mimetype,
          size: file.size,
        });
        attachmentIds.push(fileDoc._id);

        const lowerName = file.originalname.toLowerCase();
        const isAudio = file.mimetype.startsWith('audio/') || lowerName.endsWith('.wav') || lowerName.endsWith('.mp3') || lowerName.endsWith('.webm') || lowerName.endsWith('.ogg') || lowerName.endsWith('.m4a');
        const isImage = file.mimetype.startsWith('image/');
        const isVideo = file.mimetype.startsWith('video/');
        const isPdf = file.mimetype === 'application/pdf' || lowerName.endsWith('.pdf');
        const isWord = file.mimetype.includes('word') || lowerName.endsWith('.doc') || lowerName.endsWith('.docx');
        const isExcel = file.mimetype.includes('excel') || file.mimetype.includes('spreadsheet') || lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.csv');
        const isZip = file.mimetype.includes('zip') || file.mimetype.includes('rar') || lowerName.endsWith('.zip') || lowerName.endsWith('.rar');

        let type = 'other';
        if (isAudio) type = 'audio';
        else if (isImage) type = 'image';
        else if (isVideo) type = 'video';
        else if (isPdf) type = 'pdf';
        else if (isWord) type = 'word';
        else if (isExcel) type = 'excel';
        else if (isZip) type = 'zip';

        if (!attachmentPath) {
          attachmentPath = cloudUrl;
          attachmentName = file.originalname;
          attachmentType = type;
          attachmentSize = file.size;
          mimeType = file.mimetype;
          if (isAudio) {
            voiceUrl = cloudUrl;
          }
        }
      }
    }


    // Validation: Reject only when BOTH message text AND files/audio are empty
    if (!message?.trim() && attachmentIds.length === 0 && !voiceUrl) {
      return res.status(400).json({ success: false, message: 'Cannot send an empty message' });
    }

    const msg = await Message.create({
      project: projectId,
      chatRoomId: projectId ? String(projectId) : undefined,
      sender: req.user._id,
      senderId: req.user._id,
      receiver: receiverId || undefined,
      receiverId: receiverId || undefined,
      message: message || '',
      attachments: attachmentIds,
      attachment: attachmentPath,
      attachmentName,
      attachmentType,
      attachmentSize,
      mimeType,
      voiceUrl,
      voiceDuration: voiceDuration ? parseFloat(voiceDuration) : 0,
      replyTo: replyTo || undefined,
      status: 'sent',
    });

    const populated = await msg.populate([
      { path: 'sender', select: 'fullName email role profileImage' },
      { path: 'attachments' },
      { path: 'replyTo', populate: { path: 'sender', select: 'fullName role' } }
    ]);

    await logActivity({
      project: projectId,
      action: 'message_sent',
      performedBy: req.user._id,
      role: req.user.role,
      description: `${req.user.fullName} sent a message on the project`,
    });

    // Notify ALL project members (admins, client, creator, assigned staff) except the sender
    try {
      const project = await Project.findById(projectId).select('client assignedStaff createdBy').lean();
      if (project) {
        const senderId = String(req.user._id);

        // Fetch all admins so admins are always notified of project messages
        const User = (await import('../models/User.js')).default;
        const admins = await User.find({ role: 'admin' }).select('_id').lean();
        const adminIds = admins.map((a) => String(a._id));

        const memberIds = [
          ...adminIds,
          ...(project.client ? [String(project.client._id || project.client)] : []),
          ...(project.createdBy ? [String(project.createdBy._id || project.createdBy)] : []),
          ...(project.assignedStaff || []).map((id) => String(id._id || id)),
        ];
        const uniqueRecipients = [...new Set(memberIds)].filter((id) => id !== senderId);

        console.log(`[sendMessage] Notifying ${uniqueRecipients.length} recipient(s) for project ${projectId}`);

        for (const recipientId of uniqueRecipients) {
          let roleLink = `/admin/projects/${projectId}`;
          if (project.client && String(recipientId) === String(project.client)) {
            roleLink = `/client/projects/${projectId}`;
          } else {
            const recipientUser = await User.findById(recipientId).select('role').lean();
            if (recipientUser?.role === 'staff') {
              roleLink = `/staff/projects/${projectId}`;
            } else if (recipientUser?.role === 'client') {
              roleLink = `/client/projects/${projectId}`;
            }
          }

          await createNotification({
            user: recipientId,
            title: 'New Message',
            message: `${req.user.fullName} sent a message`,
            type: 'chat',
            link: roleLink,
            projectId,
          });
        }
      }
    } catch (notifErr) {
      console.error('[sendMessage] Failed to send chat notifications:', notifErr.message);
    }

    // Broadcast message via WebSocket to all clients in project room
    broadcastToProject(projectId, {
      type: 'message',
      data: populated,
    });

    res.status(201).json({ success: true, message: populated });
  } catch (error) {
    console.error('Error in sendMessage controller:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      stack: error.stack,
    });
  }
};

// @desc    Get messages for a project
export const getProjectMessages = async (req, res, next) => {
  try {
    const messages = await Message.find({ project: req.params.projectId })
      .sort({ createdAt: 1 })
      .populate('sender', 'fullName email role profileImage')
      .populate('attachments')
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'fullName role' }
      });

    res.status(200).json({ success: true, messages });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark message as read
export const markMessageRead = async (req, res, next) => {
  try {
    const msg = await Message.findByIdAndUpdate(
      req.params.id,
      { isRead: true, status: 'read' },
      { new: true }
    );
    if (msg) {
      broadcastToProject(msg.project, {
        type: 'message_updated',
        data: msg,
      });
    }
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle Star message
export const toggleStarMessage = async (req, res, next) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    msg.isStarred = !msg.isStarred;
    await msg.save();
    res.status(200).json({ success: true, isStarred: msg.isStarred });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle Pin message
export const togglePinMessage = async (req, res, next) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    msg.isPinned = !msg.isPinned;
    await msg.save();
    res.status(200).json({ success: true, isPinned: msg.isPinned });
  } catch (error) {
    next(error);
  }
};

// @desc    Add or toggle message reaction
export const toggleReaction = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Administrators have read-only access and cannot send messages.',
      });
    }

    const { emoji } = req.body;
    const msg = await Message.findById(req.params.id);
    if (!msg) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const existingIndex = msg.reactions.findIndex(
      (r) => r.user.toString() === req.user._id.toString()
    );

    if (existingIndex > -1) {
      if (msg.reactions[existingIndex].emoji === emoji) {
        // Remove reaction if same emoji
        msg.reactions.splice(existingIndex, 1);
      } else {
        // Update reaction
        msg.reactions[existingIndex].emoji = emoji;
      }
    } else {
      // Add reaction
      msg.reactions.push({ user: req.user._id, emoji });
    }

    await msg.save();

    // Broadcast reaction update
    broadcastToProject(msg.project, {
      type: 'reaction_updated',
      data: {
        messageId: msg._id,
        reactions: msg.reactions,
      },
    });

    res.status(200).json({ success: true, reactions: msg.reactions });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete message (me vs everyone)
export const deleteMessage = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Administrators have read-only access and cannot send messages.',
      });
    }

    const { deleteType } = req.query; // 'me' or 'everyone'
    const msg = await Message.findById(req.params.id);
    if (!msg) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (deleteType === 'everyone') {
      // Check ownership
      if (msg.sender.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to delete this message for everyone' });
      }

      // Keep message shell but clear content
      msg.message = '🚫 This message was deleted';
      msg.attachment = '';
      msg.attachmentName = '';
      msg.attachmentType = '';
      msg.attachmentSize = 0;
      msg.mimeType = '';
      msg.voiceUrl = '';
      msg.voiceDuration = 0;
      msg.attachments = [];
      await msg.save();
    } else {
      // Delete from DB for 'me' or remove/hide
      await Message.findByIdAndDelete(req.params.id);
    }

    // Broadcast delete event
    broadcastToProject(msg.project, {
      type: 'message_deleted',
      data: {
        messageId: msg._id,
        deleteType: deleteType || 'me',
        senderId: msg.sender,
      },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};
