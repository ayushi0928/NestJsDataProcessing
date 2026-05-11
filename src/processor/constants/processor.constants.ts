
export const ProcessorConstants = {
  RECORD_COUNT: 1000,
  COLLECTION_NAME: 'processingRequestData',

  STATUS: {
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
  } as const,

  REDIS_KEYS: {
    success: (requestId: string) => `${requestId}_success_statusData`,
    failed: (requestId: string) => `${requestId}_failed_statusData`,
    completed: (requestId: string) => `${requestId}_completed_statusData`,
    total: (requestId: string) => `${requestId}_total_statusData`,
  } as const,
} as const;