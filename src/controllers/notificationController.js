import Notification from '../models/Notification.js';
import { broadcastToUser } from '../websocket/websocket.js';

// @desc  Get latest 50 notifications for the logged-in user
// @route GET /api/notifications
export const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    const unread = notifications.filter((n) => !n.isRead).length;
    res.status(200).json({ success: true, notifications, unread });
  } catch (error) {
    next(error);
  }
};

// @desc  Mark a single notification as read
// @route PATCH /api/notifications/:id/read
export const markRead = async (req, res, next) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isRead: true },
      { new: true }
    );
    if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });

    // Push read-update event to the user's live WS session
    broadcastToUser(String(req.user._id), {
      type: 'notification_read',
      data: { id: String(notif._id) },
    });

    res.status(200).json({ success: true, notification: notif });
  } catch (error) {
    next(error);
  }
};

// @desc  Mark ALL notifications as read
// @route PATCH /api/notifications/read-all
export const markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });

    // Inform the WS client so unread count resets immediately
    broadcastToUser(String(req.user._id), {
      type: 'notification_read_all',
      data: {},
    });

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};
