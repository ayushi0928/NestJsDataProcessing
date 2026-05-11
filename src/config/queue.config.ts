import * as dotenv from 'dotenv';
dotenv.config();

export type ExchangeType = 'direct' | 'fanout' | 'topic' | 'headers';

export const rabbitmqConfig = {
  url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
};

export interface QueueDefinition {
  key: string;
  name: string;
  exchangeType: ExchangeType;
  durable: boolean;
  dlqName: string;
}

export const queues: QueueDefinition[] = [
  {
    key: 'dataProcessor',
    name: 'data_processor_queue',
    exchangeType: 'direct',
    durable: true,
    dlqName: 'data_processor_dlq',
  },
  
];

export const consumerConfig = {
  prefetch: parseInt(process.env.QUEUE_PREFETCH || '10', 10),
  reconnectDelay: parseInt(process.env.QUEUE_RECONNECT_DELAY || '5000', 10),
};

export const queueMap = Object.fromEntries(
  queues.map((q) => [q.key, q])
) as Record<string, QueueDefinition>;

export const getQueueName = (key: string): string => {
  return queueMap[key]?.name || key;
};


export const QueueNames = {
  DATA_PROCESSOR: queueMap.dataProcessor.name,
  DATA_PROCESSOR_RETRY :"data_processor_dlq"
} as const;