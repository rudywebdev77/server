import Request from '../models/Request.js';
import File from '../models/File.js';
import User from '../models/User.js';
import { generateRequestNo } from '../utils/generateRequestNo.js';
import { logActivity } from '../utils/logActivity.js';
import { createNotification } from '../utils/createNotification.js';

// @desc    Create a client request
// @route   POST /api/requests
// @access  Private/Client
export const createRequest = async (req, res, next) => {
  try {
    const { title, service, description, deadline, priority, budget, instructions, contactName, contactEmail, contactPhone } = req.body;

    const requestNo = await generateRequestNo();

    // Create Request
    const request = await Request.create({
      requestNo,
      client: req.user._id,
      title,
      service,
      description,
      deadline,
      priority: priority || 'low',
      budget,
      instructions,
      contactInfo: {
        name: contactName || req.user.fullName,
        email: contactEmail || req.user.email,
        phone: contactPhone || req.user.phone,
      },
      status: 'new',
    });

    // Handle Uploaded Files
    const fileIds = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileDoc = await File.create({
          request: request._id,
          uploadedBy: req.user._id,
          fileName: file.filename,
          originalName: file.originalname,
          filePath: `/uploads/${file.filename}`,
          fileType: file.mimetype,
          size: file.size,
        });
        fileIds.push(fileDoc._id);
      }
      request.files = fileIds;
      await request.save();
    }

    res.status(201).json({
      success: true,
      message: 'Request submitted successfully',
      request,
    });

    // Background activity logging and notification dispatch (non-blocking for ⚡ instant response)
    setImmediate(async () => {
      try {
        logActivity({
          request: request._id,
          action: 'request_created',
          newValue: 'new',
          performedBy: req.user._id,
          role: req.user.role,
          description: `Client submitted a new work request: ${requestNo}`,
          attachments: fileIds,
        }).catch(() => {});

        const admins = await User.find({ role: 'admin' }).select('_id').lean();
        for (const admin of admins) {
          createNotification({
            user: admin._id,
            title: 'New Client Request',
            message: `Client ${req.user.fullName} submitted a request: ${requestNo}`,
            type: 'request',
            link: `/admin/requests`,
          }).catch(() => {});
        }
      } catch (err) {
        console.error('[createRequest Async Notif] Error:', err.message);
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Get all requests (Role-based access, pagination, filtration)
// @route   GET /api/requests
// @access  Private (Admin, Client)
export const getRequests = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;

    const query = {};

    // Client only sees their own requests
    if (req.user.role === 'client') {
      query.client = req.user._id;
    }

    // Status filtration
    if (status) {
      query.status = status;
    }

    // Search query
    if (search && search.trim()) {
      const cleanSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: cleanSearch, $options: 'i' } },
        { requestNo: { $regex: cleanSearch, $options: 'i' } },
        { service: { $regex: cleanSearch, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [total, requests] = await Promise.all([
      Request.countDocuments(query),
      Request.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('client', 'fullName email')
        .populate('files')
        .lean(),
    ]);


    res.status(200).json({
      success: true,
      count: requests.length,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
      },
      requests,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single request
// @route   GET /api/requests/:id
// @access  Private (Admin, Client)
export const getRequest = async (req, res, next) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate('client', 'fullName email phone')
      .populate('files')
      .lean();

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Check permissions
    if (req.user.role === 'client' && request.client._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this request' });
    }

    res.status(200).json({
      success: true,
      request,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin review: update status, reject with reason
// @route   PUT /api/requests/:id/review
// @access  Private/Admin
export const reviewRequest = async (req, res, next) => {
  try {
    const { status, rejectReason, internalNotes } = req.body;

    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const oldStatus = request.status;

    if (status) request.status = status;
    if (rejectReason !== undefined) request.rejectReason = rejectReason;
    if (internalNotes !== undefined) request.internalNotes = internalNotes;

    await request.save();

    // Log Activity if status changed
    if (status && oldStatus !== status) {
      await logActivity({
        request: request._id,
        action: 'request_status_changed',
        oldValue: oldStatus,
        newValue: status,
        performedBy: req.user._id,
        role: req.user.role,
        description: `Admin changed request status from ${oldStatus} to ${status}`,
      });

      // Notify Client
      await createNotification({
        user: request.client,
        title: 'Request Status Updated',
        message: `Your request ${request.requestNo} status is now ${status.replace('_', ' ')}.`,
        type: 'request',
        link: `/client/requests/${request._id}`,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Request reviewed successfully',
      request,
    });
  } catch (error) {
    next(error);
  }
};
