import * as dotenv from 'dotenv';
dotenv.config();

export const databaseConfig = {
  uri: process.env.MONGO_URI || 'mongodb://localhost:27017/processor_db',
  dbName: process.env.MONGO_DB_NAME || 'processor_db',
};
