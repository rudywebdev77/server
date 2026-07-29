import ActivityLog from '../models/ActivityLog.js';

export const logActivity = async ({
  project,
  request,
  action,
  oldValue = '',
  newValue = '',
  performedBy,
  role,
  description,
  attachments = [],
}) => {
  try {
    await ActivityLog.create({
      project,
      request,
      action,
      oldValue,
      newValue,
      performedBy,
      role,
      description,
      attachments,
    });
  } catch (error) {
    console.error('Error logging activity:', error.message);
  }
};
export default logActivity;
