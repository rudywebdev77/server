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
    const [
      totalUsers,
      totalClients,
      totalStaff,
      newRequests,
      activeProjects,
      completedProjects,
      pendingReviews,
      upcomingDeadlines,
      recentActivity,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'client' }),
      User.countDocuments({ role: 'staff' }),
      Request.countDocuments({ status: 'new' }),
      Project.countDocuments({ status: { $nin: ['completed', 'cancelled'] } }),
      Project.countDocuments({ status: 'completed' }),
      Project.countDocuments({ status: 'under_review' }),
      Project.find({
        status: { $nin: ['completed', 'cancelled'] },
        deadline: { $gte: new Date() },
      })
        .sort({ deadline: 1 })
        .limit(5)
        .populate('client', 'fullName')
        .lean(),
      ActivityLog.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('performedBy', 'fullName role')
        .populate('project', 'projectName')
        .populate('request', 'title requestNo')
        .lean(),
    ]);


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

    const myProjectIds = await Project.find({ assignedStaff: staffId }).select('_id').lean();
    const projectIds = myProjectIds.map((p) => p._id);

    const [
      assignedProjects,
      newAssignments,
      pendingTasks,
      waitingForReview,
      completedTasks,
      upcomingDeadlines,
      recentActivity,
    ] = await Promise.all([
      Project.countDocuments({ assignedStaff: staffId }),
      Project.countDocuments({ assignedStaff: staffId, status: 'assigned' }),
      Project.countDocuments({
        assignedStaff: staffId,
        status: { $in: ['not_started', 'assigned', 'in_progress', 'revision_required'] },
      }),
      Project.countDocuments({ assignedStaff: staffId, status: 'under_review' }),
      Project.countDocuments({ assignedStaff: staffId, status: 'completed' }),
      Project.find({
        status: { $nin: ['completed', 'cancelled'] },
        deadline: { $gte: new Date() },
      })
        .sort({ deadline: 1 })
        .limit(5)
        .populate('client', 'fullName')
        .lean(),
      ActivityLog.find({ project: { $in: projectIds } })
        .sort({ createdAt: -1 })
        .limit(8)
        .populate('performedBy', 'fullName role')
        .populate('project', 'projectName')
        .lean(),
    ]);

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

    const [myProjects, myRequests] = await Promise.all([
      Project.find({ client: clientId }).select('_id').lean(),
      Request.find({ client: clientId }).select('_id').lean(),
    ]);

    const projectIds = myProjects.map((p) => p._id);
    const requestIds = myRequests.map((r) => r._id);

    const [
      submittedRequests,
      activeProjects,
      completedProjects,
      pendingResponses,
      unreadMessages,
      totalFiles,
      recentActivity,
    ] = await Promise.all([
      Request.countDocuments({ client: clientId }),
      Project.countDocuments({ client: clientId, status: { $nin: ['completed', 'cancelled'] } }),
      Project.countDocuments({ client: clientId, status: 'completed' }),
      Request.countDocuments({ client: clientId, status: 'under_review' }),
      Message.countDocuments({ project: { $in: projectIds }, sender: { $ne: clientId }, isRead: false }),
      File.countDocuments({ $or: [{ project: { $in: projectIds } }, { request: { $in: requestIds } }] }),
      ActivityLog.find({ $or: [{ project: { $in: projectIds } }, { request: { $in: requestIds } }] })
        .sort({ createdAt: -1 })
        .limit(8)
        .populate('performedBy', 'fullName role')
        .populate('project', 'projectName')
        .populate('request', 'title requestNo')
        .lean(),
    ]);

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

