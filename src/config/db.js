import mongoose from 'mongoose';
import { MONGO_URI } from './env.js';
import dns from "node:dns/promises";
dns.setServers(["1.1.1.1"]);

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`${error}`);
    process.exit(1);
  }
};
