import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'YOUR_MONGODB_URI';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

interface CachedMongoose {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: CachedMongoose | undefined;
}

const cached: CachedMongoose = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands:          false,
      maxPoolSize:             5,    // Max 5 connections per serverless instance
      minPoolSize:             1,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS:         30000,
      connectTimeoutMS:        10000,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;
