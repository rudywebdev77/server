import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';

export default async function handler(req, res) {
  try {
    await connectDB();
  } catch (dbErr) {
    console.error('Vercel handler DB connection error:', dbErr);
  }
  return app(req, res);
}
