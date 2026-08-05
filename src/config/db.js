import mongoose from 'mongoose';
import { MONGO_URI } from './env.js';
import { seedDatabase } from '../utils/seed.js';

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export const connectDB = async () => {
  if (cached.conn || mongoose.connection.readyState >= 1) {
    return cached.conn;
  }

  if (!MONGO_URI) {
    throw new Error('MONGO_URI environment variable is missing.');
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Turn off buffering to prevent 10s timeout errors on serverless
      serverSelectionTimeoutMS: 5000,
    };

    cached.promise = mongoose.connect(MONGO_URI, opts).then(async (m) => {
      console.log(`MongoDB Connected: ${m.connection.host}`);
      try {
        await seedDatabase();
      } catch (seedErr) {
        console.error('Auto seed database error:', seedErr);
      }
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error(`MongoDB Connection Error: ${e.message}`);
    throw e;
  }

  return cached.conn;
};



