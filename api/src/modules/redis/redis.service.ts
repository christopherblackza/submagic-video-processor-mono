import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType | null = null;
  private readonly apiKeyKey = 'submagic:apiKey';

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.client = createClient({ url });
    this.client.on('error', (err) => this.logger.error(`Redis error: ${err?.message || err}`));
    this.client.connect().then(() => this.logger.log('Connected to Redis')).catch((err) => {
      this.logger.error(`Failed to connect to Redis: ${err?.message || err}`);
      this.client = null;
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {}
      this.client = null;
    }
  }

  async setApiKey(apiKey: string): Promise<void> {
    if (!apiKey || !apiKey.trim()) return;
    if (!this.client) throw new Error('Redis client is not connected');
    await this.client.set(this.apiKeyKey, apiKey.trim());
  }

  async getApiKey(): Promise<string | undefined> {
    if (!this.client) throw new Error('Redis client is not connected');
    const val = (await this.client.get(this.apiKeyKey)) as string | null;
    if (typeof val === 'string' && val.trim() !== '') return val;
    return undefined;
  }
}
