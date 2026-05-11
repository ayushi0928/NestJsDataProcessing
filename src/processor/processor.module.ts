import { Module, Controller, Get } from '@nestjs/common';
import { DataProcessorController } from './controller/dataProcessor.controller';
import { DataProcessorService } from './services/dataProcessor.service';
import { DataProcessorConsumer } from './consumers/dataProcessor.consumer';
import { DataProcessorRetryConsumer } from './consumers/dataProcessorRetry.consumer';

import { MongoDBModule } from '../infrastructure/mongodb.module';
import { RabbitmqInfraModule } from '../infrastructure/queueSetup.module';


@Controller()
class HealthController {
  @Get('healthCheck')
  check() {
    return {
      service: 'Data Processing Service : Running',
      uptime: Math.floor(process.uptime()),
    };
  }
}
@Module({
  imports: [MongoDBModule, RabbitmqInfraModule],
  controllers: [
    HealthController,           
    DataProcessorController,   
  ],
  providers: [DataProcessorService, DataProcessorConsumer ,DataProcessorRetryConsumer],
})
export class ProcessorModule {}
