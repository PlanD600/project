import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';
import logger from './logger';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  logger.fatal('DATABASE_URL environment variable is not set. Please add it to your .env file.');
  throw new Error('DATABASE_URL environment variable is not set. Please add it to your .env file.');
}

const client = new MongoClient(connectionString);
let dbInstance: Db;

export const connectDB = async () => {
  try {
    await client.connect();
    dbInstance = client.db(); // Use the default database from the connection string
    logger.info('✅ Successfully connected to MongoDB');
    // Create indexes for collections to ensure performance and data integrity
    await dbInstance.collection('users').createIndex({ email: 1 }, { unique: true });
    logger.info('Ensured indexes for collections.');
  } catch (error) {
    logger.error({ message: '❌ Failed to connect to MongoDB', error });
    throw error;
  }
};

/**
 * Returns the database instance.
 * @returns {Db} The MongoDB database instance.
 */
export const getDb = (): Db => {
  if (!dbInstance) {
    const err = new Error('Database not initialized. Call connectDB during application startup.');
    logger.fatal({ message: err.message, stack: err.stack });
    throw err;
  }
  return dbInstance;
};