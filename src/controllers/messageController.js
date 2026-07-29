import Message from '../models/Message.js';
import File from '../models/File.js';
import { logActivity } from '../utils/logActivity.js';
import { createNotification } from '../utils/createNotification.js';

// @desc    Send message
export const sendMessage = async (req, res, next) => {
  try {
    const { projectId, receiverId, message } = req.body;

    const attachmentIds = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileDoc = await File.create({
          project: projectId,
          uploadedBy: req.user._id,
          fileName: file.filename, originalName: file.originalname,
          filePath: `/uploads/${file.filename}`, fileType: file.mimetype, size: file.size,
        });
        attachmentIds.push(fileDoc._id);
      }
    }

    const msg = await Message.create({
      project: projectId, sender: req.user._id,
      receiver: receiverId || undefined, message,
      attachments: attachmentIds,
    });

    const populated = await msg.populate(['sender', 'attachments']);

    await logActivity({
      project: projectId, action: 'message_sent',
      performedBy: req.user._id, role: req.user.role,
      description: `${req.user.fullName} sent a message on the project`,
    });

    if (receiverId) {
      await createNotification({
        user: receiverId, title: 'New Message',
        message: `${req.user.fullName} sent you a message`,
        type: 'message', link: `/admin/projects/${projectId}`,
      });
    }

    res.status(201).json({ success: true, message: populated });
  } catch (error) {
    next(error);
  }
};

// @desc    Get messages for a project
export const getProjectMessages = async (req, res, next) => {
  try {
    const messages = await Message.find({ project: req.params.projectId })
      .sort({ createdAt: 1 })
      .populate('sender', 'fullName email role profileImage')
      .populate('attachments');

    res.status(200).json({ success: true, messages });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark message as read
export const markMessageRead = async (req, res, next) => {
  try {
    await Message.findByIdAndUpdate(req.params.id, { isRead: true });
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};
