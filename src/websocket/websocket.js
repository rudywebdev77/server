import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import User from '../models/User.js';

// Map of userId -> WebSocket client
export const connectedClients = new Map();

export const initWebSocketServer = (httpServer) => {
  const wss = new WebSocketServer({ noServer: true });

  // Handle upgrade to verify authentication before connection
  httpServer.on('upgrade', async (request, socket, head) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id).select('fullName email status');

      if (!user || user.status === 'deactivated' || user.status === 'inactive') {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.userId = String(user._id);
        ws.userFullName = user.fullName;
        ws.isAlive = true;
        ws.currentProjectId = null;
        wss.emit('connection', ws, request);
      });
    } catch (err) {
      console.error('WebSocket Handshake Upgrade Error:', err.message);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  });

  wss.on('connection', async (ws) => {
    const userId = ws.userId;
    console.log(`WebSocket client connected: ${ws.userFullName} (${userId})`);

    // Store in connected clients map (Set per user to support multi-tab/reconnects)
    if (!connectedClients.has(userId)) {
      connectedClients.set(userId, new Set());
    }
    connectedClients.get(userId).add(ws);

    // Update user status in DB
    try {
      await User.findByIdAndUpdate(userId, { isOnline: true });
      // Broadcast online status to all
      broadcastToAll({
        type: 'user_status',
        data: { userId, isOnline: true, lastSeen: new Date() }
      });
    } catch (err) {
      console.error('Error updating user online status:', err);
    }

    // Set up heartbeat pong handler
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle messages
    ws.on('message', async (messageData) => {
      try {
        const parsed = JSON.parse(messageData);

        switch (parsed.type) {
          case 'join_project':
            console.log(`[WS Server] User ${ws.userFullName} (${userId}) joined project room: ${parsed.projectId}`);
            ws.currentProjectId = String(parsed.projectId);
            break;

          case 'leave_project':
            console.log(`[WS Server] User ${ws.userFullName} (${userId}) left project room: ${ws.currentProjectId}`);
            ws.currentProjectId = null;
            break;

          case 'typing':
            if (ws.currentProjectId) {
              broadcastToProject(ws.currentProjectId, {
                type: 'typing',
                data: {
                  userId,
                  userName: ws.userFullName,
                  isTyping: parsed.isTyping
                }
              }, userId); // Exclude the sender
            }
            break;

          default:
            console.warn(`[WS Server] Unknown WebSocket message type: ${parsed.type}`);
        }
      } catch (err) {
        console.error('[WS Server] Error parsing client message:', err.message);
      }
    });

    // Handle close connection
    ws.on('close', async () => {
      console.log(`[WS Server] WebSocket client disconnected: ${ws.userFullName} (${userId})`);
      const userSockets = connectedClients.get(userId);
      if (userSockets) {
        userSockets.delete(ws);
        if (userSockets.size === 0) {
          connectedClients.delete(userId);

          // Update user status in DB only when all connections for this user are closed
          try {
            const lastSeen = new Date();
            await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
            // Broadcast offline status to all
            broadcastToAll({
              type: 'user_status',
              data: { userId, isOnline: false, lastSeen }
            });
          } catch (err) {
            console.error('Error updating user offline status:', err);
          }
        }
      }
    });

    // Handle socket error
    ws.on('error', (err) => {
      console.error(`[WS Server] WebSocket error for user ${ws.userFullName}:`, err);
    });
  });

  // KeepAlive ping-pong loop
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.log(`[WS Server] Terminating inactive WebSocket client: ${ws.userFullName}`);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  return wss;
};

/**
 * Broadcast payload to all clients in a specific project room
 * @param {string} projectId 
 * @param {object} payload 
 * @param {string} [excludeUserId] - Optional userId to exclude from broadcast
 */
export const broadcastToProject = (projectId, payload, excludeUserId = null) => {
  const jsonStr = JSON.stringify(payload);
  const projectIdStr = String(projectId);

  for (const [uid, sockets] of connectedClients.entries()) {
    if (excludeUserId && uid === String(excludeUserId)) {
      continue;
    }
    for (const ws of sockets) {
      if (ws.currentProjectId === projectIdStr && ws.readyState === 1) {
        ws.send(jsonStr);
      }
    }
  }
};

/**
 * Send payload to a specific user across all their active sockets
 * @param {string} userId 
 * @param {object} payload 
 */
export const broadcastToUser = (userId, payload) => {
  const sockets = connectedClients.get(String(userId));
  if (sockets && sockets.size > 0) {
    const jsonStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    for (const ws of sockets) {
      if (ws.readyState === 1) {
        ws.send(jsonStr);
      }
    }
  }
};

/**
 * Broadcast to all connected clients
 * @param {object} payload 
 */
export const broadcastToAll = (payload) => {
  const jsonStr = JSON.stringify(payload);
  for (const sockets of connectedClients.values()) {
    for (const ws of sockets) {
      if (ws.readyState === 1) {
        ws.send(jsonStr);
      }
    }
  }
};
