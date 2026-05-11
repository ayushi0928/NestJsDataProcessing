import { Module } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { databaseConfig } from '../config/database.config';

@Module({
  providers: [
    {
      provide: 'MONGO_CLIENT',
      useFactory: async () => {
        const client = new MongoClient(databaseConfig.uri);
        await client.connect();
        console.log('Successfull connecting database');
        return client;
      },
    },
    {
      provide: 'MONGO_DB',
      useFactory: (client: MongoClient) => client.db(databaseConfig.dbName),
      inject: ['MONGO_CLIENT'],
    },
  ],
  exports: ['MONGO_CLIENT', 'MONGO_DB'],
})
export class MongoDBModule {}
