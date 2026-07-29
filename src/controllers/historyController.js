import ActivityLog from "../models/ActivityLog.js";

// Get activity history for a project
export const getProjectHistory = async (req, res, next) => {
  try {
    const history = await ActivityLog.find({
      project: req.params.projectId,
    })
      .populate("performedBy", "fullName email role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: history.length,
      history,
    });
  } catch (error) {
    next(error);
  }
};

// Get activity history for a request
export const getRequestHistory = async (req, res, next) => {
  try {
    const history = await ActivityLog.find({
      request: req.params.requestId,
    })
      .populate("performedBy", "fullName email role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: history.length,
      history,
    });
  } catch (error) {
    next(error);
  }
};