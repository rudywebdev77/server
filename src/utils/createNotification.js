import Notification from '../models/Notification.js';

export const createNotification = async ({ user, title, message, type, link }) => {
  try {
    await Notification.create({
      user,
      title,
      message,
      type,
      link: link || '',
    });
  } catch (error) {
    console.error('Error creating notification:', error.message);
  }
};
export default createNotification;
