import mongoose from 'mongoose';
import { loadEnv } from './env.js';
import { logger } from './logger.js';

export async function connectDb(uri?: string): Promise<typeof mongoose | null> {
  const env = loadEnv();
  const target = uri ?? env.MONGODB_URI;
  if (!target) {
    logger.warn('MONGODB_URI is not set — skipping Mongo connection (dev only).');
    return null;
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(target, { autoIndex: env.NODE_ENV !== 'production' });
  logger.info({ host: mongoose.connection.host, db: mongoose.connection.name }, 'mongo connected');
  return mongoose;
}

export async function disconnectDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
