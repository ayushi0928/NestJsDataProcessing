import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import * as amqplib from 'amqplib';

import { DataProcessorService } from '../services/dataProcessor.service';
import { RequestToProcess } from '../dto/request-to-process.interface';

import { rabbitmqConfig, consumerConfig } from '../../config/queue.config';
import { QueueNames } from '../../config/queue.config';

@Injectable()
export class DataProcessorConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(`${DataProcessorConsumer.name}_processor_consumer`);

  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;

  constructor(
    private readonly dataProcessorService: DataProcessorService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close().catch(() => null);
    await this.connection?.close().catch(() => null);
    this.logger.log('Consumer stopped ');
  }

  private async connect(): Promise<void> {
    try {
      this.connection = await amqplib.connect(rabbitmqConfig.url);
      this.channel = await this.connection.createChannel();

    
      this.channel.prefetch(consumerConfig.prefetch);


      this.connection.on('error', (err) => {
        this.logger.error(`Queue connection error : ${err.message}`);
        this.scheduleReconnect();
      });

      this.connection.on('close', () => {
        this.logger.warn('Queue connection closed : Retry attempting');
        this.scheduleReconnect();
      });

  
      await this.channel.consume(
        QueueNames.DATA_PROCESSOR,                   
        async (msg) => {
          if (!msg) return;

          try {
            const job: RequestToProcess = JSON.parse(msg.content.toString());
            
            await this.dataProcessorService.processSingleRecord(job);

            this.channel!.ack(msg);                   
          } catch (err: any) {
            this.channel!.nack(msg, false, false);    
            this.logger.error(`Cannot process request for ${(JSON.parse(msg.content.toString()) as any).id} | ${err.message}`);
          }
        },
        { noAck: false },
      );

      this.logger.log(`Consumer availble for queue ${QueueNames.DATA_PROCESSOR}`);
    } catch (err: any) {
      this.logger.error(`Consumer not available for queue ${QueueNames.DATA_PROCESSOR} : ${err.message}`);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    this.channel = null;
    this.connection = null;

    setTimeout(() => {
      this.logger.log('Initiating consumer reconnect');
      this.connect();
    }, consumerConfig.reconnectDelay);
  }
}