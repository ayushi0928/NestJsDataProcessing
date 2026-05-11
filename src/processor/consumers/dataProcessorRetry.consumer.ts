import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import * as amqplib from "amqplib";

import { DataProcessorService } from "../services/dataProcessor.service";
import { RequestToProcess } from "../dto/request-to-process.interface";

import { rabbitmqConfig, consumerConfig } from "../../config/queue.config";
import { QueueNames } from "../../config/queue.config";

@Injectable()
export class DataProcessorRetryConsumer
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(
    `${DataProcessorRetryConsumer.name}_processor_consumer`,
  );

  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;

  constructor(private readonly dataProcessorService: DataProcessorService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close().catch(() => null);
    await this.connection?.close().catch(() => null);
    this.logger.log("Consumer stopped ");
  }

  private async connect(): Promise<void> {
    try {
      this.connection = await amqplib.connect(rabbitmqConfig.url);
      this.channel = await this.connection.createChannel();
      this.channel.prefetch(consumerConfig.prefetch);
      this.connection.on("error", (err) => {
        this.logger.error(`Queue connection error : ${err.message}`);
        this.scheduleReconnect();
      });

      this.connection.on("close", () => {
        this.logger.warn("Queue connection closed : Retry attempting");
        this.scheduleReconnect();
      });
      await this.channel.consume(
        QueueNames.DATA_PROCESSOR_RETRY,
        async (msg) => {
          if (!msg) return;

          let job: RequestToProcess;
          try {
            job = JSON.parse(msg.content.toString());
          } catch (parseErr) {
            this.logger.log(
              `Cannot parse message received as : ${msg.content.toString()}`,
            );
            this.logger.error("Failed to parse message on retry ", parseErr);
            this.channel!.ack(msg);
            return;
          }

          try {
            const { requestId } = job;
            this.logger.log(
              `Retrying data process with request id : ${requestId} : as : ${JSON.stringify(job)}`,
            );
            await this.dataProcessorService.processWithRetry(job);

            this.channel!.ack(msg);
            this.logger.log(
              `REQ_ID_${requestId} : Data process request recovered ${requestId}`,
            );
          } catch (err: any) {
            this.logger.log(
              `REQ_ID_${job.requestId} : Data process request recovery failed as : ${JSON.stringify(job)}`,
            );
            this.logger.log(
              `REQ_ID_${job.requestId} : Data process request data save intiated`,
            )
            await this.dataProcessorService.saveToRetryData(
              job,
              err.message || "Retry failed in DLQ",
            );

            this.channel!.ack(msg); 
          }
        },
        { noAck: false },
      );

      this.logger.log(`Consumer availble for queue ${QueueNames.DATA_PROCESSOR_RETRY}`);
    } catch (err: any) {
      this.logger.error(`Consumer not available for queue ${QueueNames.DATA_PROCESSOR_RETRY} : ${err.message}`);
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
