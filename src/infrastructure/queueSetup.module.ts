import { Module, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as amqplib from 'amqplib';
import { queues ,rabbitmqConfig } from '../config/queue.config';

@Injectable()
class RabbitmqSetupService implements OnModuleInit {
  private readonly logger = new Logger(`${RabbitmqSetupService.name}_infrastructure_rabbitmq`);

  async onModuleInit(): Promise<void> {
    this.logger.log('Connecting queue services');
    const conn = await amqplib.connect(rabbitmqConfig.url);

    for (const queue of queues) {
      // Removing previous stale connection to create fresh setup
      const deleteCh = await conn.createChannel();
      await deleteCh.deleteQueue(queue.name).catch(() => null);
      await deleteCh.close().catch(() => null);

      const setupCh = await conn.createChannel();
      await setupCh.assertQueue(queue.name, {
        durable: queue.durable,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': queue.dlqName,
        },
      });
      await setupCh.assertQueue(queue.dlqName, { durable: queue.durable });
      await setupCh.close();

      this.logger.log(`Queue connected as : Name : ${queue.name} : DLQ: ${queue.dlqName}`);
    }

    await conn.close();
    this.logger.log('Successfull connection to queue service');
  }
}

@Module({
  providers: [RabbitmqSetupService],
})
export class RabbitmqInfraModule {}
