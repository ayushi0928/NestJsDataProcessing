import * as amqplib from "amqplib";
import { Logger } from "@nestjs/common";
import { rabbitmqConfig } from "../config/queue.config";

export class QueueProducer {
  private static readonly logger = new Logger("QueueProducer_queueController");
  private static connection: amqplib.ChannelModel | null = null;
  private static channel: amqplib.Channel | null = null;

  static async getChannel(): Promise<amqplib.Channel> {
    if (this.channel) return this.channel;

    this.connection = await amqplib.connect(rabbitmqConfig.url);
    this.channel = await this.connection.createChannel();

    this.connection.on("error", (err) => {
      this.logger.error(`Cannot connect queue : Error : ${err.message}`);
      this.channel = null;
      this.connection = null;
    });

    this.connection.on("close", () => {
      this.logger.warn("Queue connection closed : current process completed");
      this.channel = null;
      this.connection = null;
    });

    this.logger.log("Queue producer connected succesfully");
    return this.channel;
  }

  static async publish(queue: string, messages: unknown[]): Promise<number> {
    const channel = await this.getChannel();
    let published = 0;
    this.logger.log(
      `Started message publishing to queue : ${queue}`,
    );
    for (const message of messages) {
      const sent = channel.sendToQueue(
        queue,
        Buffer.from(JSON.stringify(message)),
        { persistent: true, contentType: "application/json" },
      );

      if (sent) {
        published++;
      } else {
        this.logger.warn(`Message cannot be added to queue: ${queue}`);
      }
    }

    this.logger.log(
      `Completed message publishing to queue : ${queue} : Status  ${published}/${messages.length}`,
    );
    return published;
  }

  static async close(): Promise<void> {
    if (this.channel) await this.channel.close().catch(() => null);
    if (this.connection) await this.connection.close().catch(() => null);
    this.channel = null;
    this.connection = null;
  }
}
