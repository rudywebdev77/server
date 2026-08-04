import User from '../models/User.js';
import Request from '../models/Request.js';
import Project from '../models/Project.js';
import File from '../models/File.js';
import Message from '../models/Message.js';
import ActivityLog from '../models/ActivityLog.js';

// @desc    Get Admin Dashboard Stats
// @route   GET /api/dashboard/admin
// @access  Private/Admin
export const getAdminStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalClients = await User.countDocuments({ role: 'client' });
    const totalStaff = await User.countDocuments({ role: 'staff' });
    
    const newRequests = await Request.countDocuments({ status: 'new' });
    const activeProjects = await Project.countDocuments({
      status: { $nin: ['completed', 'cancelled'] },
    });
    const completedProjects = await Project.countDocuments({ status: 'completed' });
    const pendingReviews = await Project.countDocuments({ status: 'under_review' });

    // Upcoming deadlines
    const upcomingDeadlines = await Project.find({
      status: { $nin: ['completed', 'cancelled'] },
      deadline: { $gte: new Date() },
    })
      .sort({ deadline: 1 })
      .limit(5)
      .populate('client', 'fullName');

    // Recent activity logs
    const recentActivity = await ActivityLog.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('performedBy', 'fullName role')
      .populate('project', 'projectName')
      .populate('request', 'title requestNo');

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalClients,
        totalStaff,
        newRequests,
        activeProjects,
        completedProjects,
        pendingReviews,
      },
      upcomingDeadlines,
      recentActivity,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Staff Dashboard Stats
// @route   GET /api/dashboard/staff
// @access  Private/Staff
export const getStaffStats = async (req, res, next) => {
  try {
    const staffId = req.user._id;

    const assignedProjects = await Project.countDocuments({
      assignedStaff: staffId,
    });
    
    const newAssignments = await Project.countDocuments({
      assignedStaff: staffId,
      status: 'assigned',
    });

    const pendingTasks = await Project.countDocuments({
      assignedStaff: staffId,
      status: { $in: ['not_started', 'assigned', 'in_progress', 'revision_required'] },
    });

    const waitingForReview = await Project.countDocuments({
      assignedStaff: staffId,
      status: 'under_review',
    });

    const completedTasks = await Project.countDocuments({
      assignedStaff: staffId,
      status: 'completed',
    });

    // Upcoming deadlines
    const upcomingDeadlines = await Project.find({
      status: { $nin: ['completed', 'cancelled'] },
      deadline: { $gte: new Date() },
    })
      .sort({ deadline: 1 })
      .limit(5)
      .populate('client', 'fullName');

    // Recent activities on assigned projects
    const myProjectIds = await Project.find({ assignedStaff: staffId }).select('_id');
    const projectIds = myProjectIds.map((p) => p._id);

    const recentActivity = await ActivityLog.find({
      project: { $in: projectIds },
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('performedBy', 'fullName role')
      .populate('project', 'projectName');

    res.status(200).json({
      success: true,
      stats: {
        assignedProjects,
        newAssignments,
        pendingTasks,
        waitingForReview,
        completedTasks,
      },
      upcomingDeadlines,
      recentActivity,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Client Dashboard Stats
// @route   GET /api/dashboard/client
// @access  Private/Client
export const getClientStats = async (req, res, next) => {
  try {
    const clientId = req.user._id;

    const submittedRequests = await Request.countDocuments({ client: clientId });
    
    const activeProjects = await Project.countDocuments({
      client: clientId,
      status: { $nin: ['completed', 'cancelled'] },
    });

    const completedProjects = await Project.countDocuments({
      client: clientId,
      status: 'completed',
    });

    const pendingResponses = await Request.countDocuments({
      client: clientId,
      status: 'under_review',
    });

    // Fetch projects
    const myProjects = await Project.find({ client: clientId }).select('_id');
    const projectIds = myProjects.map((p) => p._id);

    // Unread chat messages for client's projects
    const unreadMessages = await Message.countDocuments({
      project: { $in: projectIds },
      sender: { $ne: clientId },
      isRead: false,
    });

    // Available files count
    const totalFiles = await File.countDocuments({
      $or: [
        { project: { $in: projectIds } },
        { request: { $in: await Request.find({ client: clientId }).select('_id') } },
      ],
    });

    // Get recent activities related to client requests/projects
    const recentActivity = await ActivityLog.find({
      $or: [
        { project: { $in: projectIds } },
        { request: { $in: await Request.find({ client: clientId }).select('_id') } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('performedBy', 'fullName role')
      .populate('project', 'projectName')
      .populate('request', 'title requestNo');

    res.status(200).json({
      success: true,
      stats: {
        submittedRequests,
        activeProjects,
        completedProjects,
        pendingResponses,
        totalFiles,
        unreadMessages,
      },
      recentActivity,
    });
  } catch (error) {
    next(error);
  }
};
