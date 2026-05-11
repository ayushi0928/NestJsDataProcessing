import * as crypto from 'crypto';

export class Utils {
  static generateHash(job: any): string {
    return crypto
      .createHash('sha256')
      .update(`${job.id}|${job.data}|${job.batchId}`)
      .digest('hex');
  }

  static generateUUID(): string {
    return crypto.randomUUID();
  }
}