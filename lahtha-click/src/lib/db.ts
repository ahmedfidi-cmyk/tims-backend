import mongoose from 'mongoose';
import { loadConfig } from '../config/index.js';
import { logger } from './logger.js';

export async function connectDatabase(): Promise<typeof mongoose> {
  const config = loadConfig();
  await mongoose.connect(config.MONGO_URI, {
    dbName: config.MONGO_DB_NAME,
    serverSelectionTimeoutMS: 5000,
  });
  logger.info({ db: config.MONGO_DB_NAME }, 'connected to mongodb');
  return mongoose;
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  logger.info('disconnected from mongodb');
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
