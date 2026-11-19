import app from './app.js';
import { connectDB } from './config/db.js';
import { PORT } from './config/env.js';
import { seedDatabase } from './utils/seed.js';
import { initWebSocketServer } from './websocket/websocket.js';

// Connect to Database
connectDB().then(() => {
  seedDatabase();
});

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Initialize WebSocket Server
initWebSocketServer(server);

// Handle unhandled promise rejections without crashing the server
process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED REJECTION]', err?.stack || err?.message || err);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err?.stack || err?.message || err);
});
