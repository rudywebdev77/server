import app from './app.js';
import { connectDB } from './config/db.js';
import { PORT } from './config/env.js';
import { seedDatabase } from './utils/seed.js';

// Connect to Database
connectDB().then(() => {
  seedDatabase();
});

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Unhandled Rejection Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
