import { Module, Global, Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { redisConfig } from '../config/redis.config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(`${RedisService.name}__infrastructure_redis`);
  private client: Redis;

  onModuleInit(): void {
    this.client = new Redis({ host: redisConfig.host, port: redisConfig.port });
    this.client.on('error', (err) => this.logger.error(`Cannot connect redis : Error : ${err.message}`));
    this.logger.log(`Successfull connection to redis as  : ${redisConfig.host}:${redisConfig.port}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string | number): Promise<void> {
    await this.client.set(key, String(value));
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length) await this.client.del(...keys);
  }

  async mget(...keys: string[]): Promise<(string | null)[]> {
    return this.client.mget(...keys);
  }
}

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisInfraModule {}
