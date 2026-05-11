import { Module } from '@nestjs/common';
import { MongoDBModule } from './infrastructure/mongodb.module';
import { RedisInfraModule } from './infrastructure/redis.module';
import { RabbitmqInfraModule } from './infrastructure/queueSetup.module';
import { ProcessorModule } from './processor/processor.module';

@Module({
  imports: [
    MongoDBModule,         // MongoDB connection 
    RedisInfraModule,      // Redis connection
    RabbitmqInfraModule,   // Queue setup — all queues asserted before consumers start
    ProcessorModule,        // Api and bussiness logic
  ],
})
export class AppModule {}
