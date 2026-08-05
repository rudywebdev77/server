import mongoose from 'mongoose';
import dns from 'node:dns';
import { MONGO_URI } from './env.js';

// Globally disable command buffering so Mongoose never hangs 10s if disconnected
mongoose.set('bufferCommands', false);

// Pre-configure DNS order for Node.js DNS lookups
try {
  if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch (e) {}


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
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
    };


    const attemptConnect = async (usePublicDns = false) => {
      if (usePublicDns) {
        try {
          dns.setServers(['8.8.8.8', '1.1.1.1']);
        } catch (dnsErr) {
          console.warn('Could not override DNS servers:', dnsErr.message);
        }
      }
      return mongoose.connect(MONGO_URI, opts);
    };

    cached.promise = attemptConnect(false)
      .catch((err) => {
        if (err.message && (err.message.includes('querySrv') || err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND'))) {
          console.warn('Initial MongoDB SRV DNS lookup failed. Retrying with Google/Cloudflare public DNS...');
          return attemptConnect(true);
        }
        throw err;
      })
      .then((m) => {
        console.log(`MongoDB Connected: ${m.connection.host}`);
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





