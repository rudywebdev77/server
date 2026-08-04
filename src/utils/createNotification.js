import Notification from '../models/Notification.js';
import { connectedClients } from '../websocket/websocket.js';

/**
 * Creates a notification in the database and instantly pushes it to the
 * target user via WebSocket if they are currently connected.
 */
export const createNotification = async ({ user, title, message, type, link, projectId }) => {
  try {
    const notif = await Notification.create({
      user,
      title,
      message,
      type,
      link: link || '',
    });

    console.log(`[createNotification] Saved notification for user ${user} | type: ${type} | title: ${title}`);

    // Real-time push to the recipient's WebSocket client(s)
    const userSockets = connectedClients.get(String(user));
    if (userSockets && userSockets.size > 0) {
      const payload = JSON.stringify({
        type: 'notification',
        data: {
          _id: String(notif._id),
          user: String(notif.user),
          title: notif.title,
          message: notif.message,
          type: notif.type,
          link: notif.link,
          isRead: false,
          createdAt: notif.createdAt,
        },
      });
      let sentCount = 0;
      for (const ws of userSockets) {
        if (ws.readyState === 1) {
          ws.send(payload);
          sentCount++;
        }
      }
      console.log(`[createNotification] WS notification sent to user ${user} across ${sentCount} socket(s)`);
    } else {
      console.log(`[createNotification] User ${user} is not connected via WS — notification saved to DB only`);
    }

    return notif;
  } catch (error) {
    console.error('Error creating notification:', error.message);
  }
};

export default createNotification;
