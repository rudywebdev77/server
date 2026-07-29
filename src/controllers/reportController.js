import Project from '../models/Project.js';
import User from '../models/User.js';
import Request from '../models/Request.js';

// @desc    Get project summary reports
// @route   GET /api/reports/projects
// @access  Private/Admin
export const getProjectReports = async (req, res, next) => {
  try {
    const totalProjects = await Project.countDocuments();
    const completed = await Project.countDocuments({ status: 'completed' });
    const inProgress = await Project.countDocuments({ status: 'in_progress' });
    const underReview = await Project.countDocuments({ status: 'under_review' });
    const cancelled = await Project.countDocuments({ status: 'cancelled' });

    const priorityBreakdown = await Project.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    const projects = await Project.find()
      .populate('client', 'fullName email')
      .populate('assignedStaff', 'fullName')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      summary: {
        totalProjects,
        completed,
        inProgress,
        underReview,
        cancelled,
        priorityBreakdown,
      },
      projects,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user activity reports
// @route   GET /api/reports/users
// @access  Private/Admin
export const getUserReports = async (req, res, next) => {
  try {
    const roleCounts = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    const statusCounts = await User.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      success: true,
      roleCounts,
      statusCounts,
    });
  } catch (error) {
    next(error);
  }
};
