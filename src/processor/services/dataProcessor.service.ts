import {
  Injectable,
  Logger,
  Inject,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Db } from "mongodb";

import { QueueProducer } from "../../queueUtils/queue.producer";
import { RedisService } from "../../infrastructure/redis.module";

import { RequestToProcess } from "../dto/request-to-process.interface";
import { ProcessorConstants } from "../constants/processor.constants";
import { Utils } from "../../common/common.utils";
import { QueueNames } from "../../config/queue.config";

@Injectable()
export class DataProcessorService {
  private readonly logger = new Logger(
    `${DataProcessorService.name}_processor_service`,
  );

  constructor(
    @Inject("MONGO_DB") private readonly db: Db,
    private readonly redisService: RedisService,
  ) {}

  private get collection() {
    return this.db.collection(ProcessorConstants.COLLECTION_NAME);
  }

  async processSingleRecord(job: RequestToProcess): Promise<void> {
    this.logger.log(`Request processing started `);
    const { requestId } = job;
    const startAt = Date.now();

    this.logger.log(
      `REQ_ID_${requestId} : Data processing done for count ${job.id} at ${startAt}ms`,
    );

    let succeeded = false;

    try {
      const hash = Utils.generateHash(job);
      succeeded = true;
if (Math.random() < 0.33) throw new Error("Random error");
      this.logger.log(
        `REQ_ID_${requestId} : CPU processing completed at ${Date.now() - startAt}ms for data count ${job.id}`,
      );
    } finally {
      if (succeeded) {
        this.logger.log(
          `REQ_ID_${requestId} : Success status updated for data count ${job.id}`,
        );
        await this.redisService.incr(
          ProcessorConstants.REDIS_KEYS.success(requestId),
        );
      } else {
        this.logger.log(
          `REQ_ID_${requestId} : Failed status updated for data count ${job.id}`,
        );
        await this.redisService.incr(
          ProcessorConstants.REDIS_KEYS.failed(requestId),
        );
      }

      const completedNow = await this.redisService.incr(
        ProcessorConstants.REDIS_KEYS.completed(requestId),
      );
      this.logger.log(
        `REQ_ID_${requestId} : Request count updated for data count ${job.id}`,
      );
      const total = parseInt(
        (await this.redisService.get(
          ProcessorConstants.REDIS_KEYS.total(requestId),
        )) ?? "0",
        10,
      );

      if (completedNow === total) {
        this.logger.log(
          `REQ_ID_${requestId} : Processing last data request at ${Date.now() - startAt}ms : ${job.id}`,
        );
        await this.finaliseRequest(requestId, startAt);
      }
    }
  }
  private async finaliseRequest(
    requestId: string,
    startAt?: number,
  ): Promise<void> {
    this.logger.log(
      `REQ_ID_${requestId} : Received finalise request data at ${Date.now() - startAt}ms`,
    );
    const [successRaw, failedRaw] = await this.redisService.mget(
      ProcessorConstants.REDIS_KEYS.success(requestId),
      ProcessorConstants.REDIS_KEYS.failed(requestId),
    );

    const success = parseInt(successRaw ?? "0", 10);
    const failed = parseInt(failedRaw ?? "0", 10);

    this.logger.log(
      `REQ_ID_${requestId} : Persisting request updates to database with data  success: ${success} | failed: ${failed} at ${Date.now() - startAt}ms`,
    );

    await this.finalizeBatch(requestId, success, failed, startAt);

    await this.redisService.del(
      ProcessorConstants.REDIS_KEYS.success(requestId),
      ProcessorConstants.REDIS_KEYS.failed(requestId),
      ProcessorConstants.REDIS_KEYS.completed(requestId),
      ProcessorConstants.REDIS_KEYS.total(requestId),
    );

    this.logger.log(
      `REQ_ID_${requestId} : Redis key removed for current batch completion`,
    );
  }

  private async createBatch(urn: string): Promise<string> {
    this.logger.log(`URN_${urn} : Batch creation request received`);
    const requestId = Utils.generateUUID();
    this.logger.log(
      `URN_${urn} : Request Id generated for the batch : ${requestId}`,
    );
    let status = await this.collection.insertOne({
      requestId,
      urn,
      statusName: ProcessorConstants.STATUS.IN_PROGRESS,
      status: 0,
      totalCount: ProcessorConstants.RECORD_COUNT,
      success: 0,
      failed: 0,
      completed: 0,
      createdOn: new Date(),
      updatedOn: new Date(),
    });
    this.logger.log(
      `URN_${urn} : Batch data inserted in database as : ${JSON.stringify({
        requestId,
        urn,
        statusName: ProcessorConstants.STATUS.IN_PROGRESS,
        status: 0,
        totalCount: ProcessorConstants.RECORD_COUNT,
        success: 0,
        failed: 0,
        completed: 0,
        createdOn: new Date(),
        updatedOn: new Date(),
      })} : status : ${JSON.stringify(status)}`,
    );
    return requestId;
  }

  private async finalizeBatch(
    requestId: string,
    success: number,
    failed: number,
    startAt?: number,
  ): Promise<void> {
    this.logger.log(
      `REQ_ID_${requestId} : Received databse update request  at ${Date.now() - startAt}ms`,
    );
    let status = await this.collection.updateOne(
      { requestId },
      {
        $set: {
          statusName: ProcessorConstants.STATUS.COMPLETED,
          status: 1,
          success,
          failed,
          completed: success + failed,
          updatedOn: new Date(),
        },
      },
    );

    this.logger.log(
      `REQ_ID_${requestId} : Databse update successfully at ${Date.now() - startAt}ms : ${JSON.stringify(status)}`,
    );
  }

  async initiateBatch(urn: string): Promise<object> {
    this.logger.log(`Request receied to process batch : URN : ${urn}`);
    const requestId = await this.createBatch(urn);

    await this.redisService.set(
      ProcessorConstants.REDIS_KEYS.total(requestId),
      ProcessorConstants.RECORD_COUNT,
    );

    const batchId = Utils.generateUUID();

    this.logger.log(
      `URN_${urn} : Batch id genrated for the request as ${batchId}`,
    );

    // Create jobs
    const jobs: RequestToProcess[] = Array.from(
      { length: ProcessorConstants.RECORD_COUNT },
      (_, i) => ({
        id: i + 1,
        data: `record-${i + 1}-${Math.random().toString(36).slice(2, 10)}`,
        timestamp: new Date().toISOString(),
        batchId,
        requestId,
        count: i + 1,
      }),
    );
    this.logger.log(`URN_${urn} : data request created to publish`);
    let published: number;
    try {
      published = await QueueProducer.publish(QueueNames.DATA_PROCESSOR, jobs);
    } catch (err: any) {
      this.logger.error(`URN_${urn} : Failed to publish batch: ${err.message}`);
      throw new ServiceUnavailableException(
        "Queue unavailable — check RabbitMQ",
      );
    }

    this.logger.log(
      `URN_${urn} : Batch ${batchId} added : ${published}/${ProcessorConstants.RECORD_COUNT} data request to queue ${QueueNames.DATA_PROCESSOR}`,
    );

    this.logger.log(
      `URN_${urn} : Response returned as ${JSON.stringify({
        requestId,
        batchId,
        requestCount: published,
      })}`,
    );
    return {
      requestId,
      batchId,
      requestCount: published,
    };
  }

  async getStatus(requestId: string): Promise<object> {
    const [successRaw, failedRaw, totalRaw] = await this.redisService.mget(
      ProcessorConstants.REDIS_KEYS.success(requestId),
      ProcessorConstants.REDIS_KEYS.failed(requestId),
      ProcessorConstants.REDIS_KEYS.total(requestId),
    );

    if (totalRaw !== null) {
      const total = parseInt(totalRaw, 10);
      const success = parseInt(successRaw ?? "0", 10);
      const failed = parseInt(failedRaw ?? "0", 10);
      const completed = success + failed;

      return {
        requestId,
        statusName: ProcessorConstants.STATUS.IN_PROGRESS,
        status: 0,
        totalCount: total,
        success,
        failed,
        completed,
        pending: Math.max(0, total - completed),
        source: "live",
      };
    }

    // Fallback to MongoDB
    const doc = await this.collection.findOne({ requestId });
    if (!doc) {
      throw new NotFoundException(
        `No record found for requestId: ${requestId}`,
      );
    }

    return {
      ...doc,
      source: "final",
    };
  }

  // 1. Retry Processing (Direct Mongo Update - No Redis)
  async processWithRetry(job: RequestToProcess): Promise<void> {
    try {
      this.logger.log(`Retry request processing started `);
      const { requestId } = job;
      const hash = Utils.generateHash(job);

      const startAt = Date.now();

      this.logger.log(
        `RETRY_REQ_ID_${requestId} : Data processing done for count ${job.id} at ${startAt}ms`,
      );

      if (Math.floor(Math.random() * 2) === 0) throw new Error("Random retry error ");

      await this.collection.updateOne(
        { requestId: job.requestId },
        {
          $inc: {
            success: 1,
            retrySuccess: 1,
          },
          $set: {
            updatedOn: new Date(),
            statusName: ProcessorConstants.STATUS.COMPLETED,
          },
        },
      );

      this.logger.log(
        `RETRY_REQ_ID_${requestId} : CPU processing completed at ${Date.now() - startAt}ms for data count ${job.id}`,
      );
    } catch (error: any) {
      this.logger.log(
        `REQ_ID_${job.requestId} : Failed retry for jon ${JSON.stringify(job)}`,
      );
      throw error;
    }
  }

  async saveToRetryData(
    job: RequestToProcess,
    errorMessage: string,
  ): Promise<void> {
    await this.db.collection("retryDataJn").insertOne({
      requestId: job.requestId,
      jobId: job.id,
      payload: job,
      errorMessage,
      failedAt: new Date(),
      status: "FINAL_FAILED",
      retryCount: 1,
      createdOn: new Date(),
    });
  }
}
