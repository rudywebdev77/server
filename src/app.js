import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { UPLOAD_PATH } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { activityLoggerMiddleware } from './middleware/activityLogger.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import historyRoutes from './routes/historyRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import clientSettingsRoutes from './routes/clientSettingsRoutes.js';
import staffSettingsRoutes from './routes/staffSettingsRoutes.js';
import companyRoutes from './routes/companyRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import { connectDB } from './config/db.js';

const app = express();

// Enable Trust Proxy for rate limiting behind reverse proxies (Vercel/Heroku/Nginx)
app.set('trust proxy', 1);

// Middleware to ensure DB connection is established (Required for Vercel Serverless Functions)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection error:', err);
    return res.status(500).json({
      success: false,
      message: 'Database connection failed. Please check MONGO_URI environment variable.',
    });
  }
});

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: false, // Allow loading local uploads
}));
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://client-red-five-32.vercel.app'],
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Automatic activity logging — fires after successful responses
app.use(activityLoggerMiddleware);


// Simple XSS Clean middleware (custom replacement for deprecated xss-clean if necessary, or just basic sanitization)
app.use((req, res, next) => {
  if (req.body) {
    const sanitize = (obj) => {
      for (let key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key].replace(/</g, '&lt;').replace(/>/g, '&gt;');
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitize(obj[key]);
        }
      }
    };
    sanitize(req.body);
  }
  next();
});

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  validate: { xForwardedForHeader: false }, // Prevent ERL_UNEXPECTED_X_FORWARDED_FOR validation error on Vercel
  message: { message: 'Too many requests from this IP, please try again after 15 minutes' },
});
app.use('/api', limiter);


// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_PATH)) {
  fs.mkdirSync(UPLOAD_PATH, { recursive: true });
}

import mongoose from 'mongoose';

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOAD_PATH));

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date() });
});

// Database status check route
app.get('/api/db-status', (req, res) => {
  try {
    const readyState = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    res.status(200).json({
      success: true,
      readyState,
      status: states[readyState] || 'unknown',
      hasMongoUri: !!process.env.MONGO_URI,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin/email-settings', emailRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/client/activity', activityRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/client', clientSettingsRoutes);
app.use('/api/staff', staffSettingsRoutes);
app.use('/api/company', companyRoutes);




// Base API route placeholder
app.get('/api', (req, res) => {
  res.json({ message: 'Welcome to Work Portal API' });
});

// Centralized error handling middleware will be added at the end of routing chain
// We will register routing next, for now just register the error handler
app.use(errorHandler);

export default app;
