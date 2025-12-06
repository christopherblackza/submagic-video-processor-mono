import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaItemDto } from '../../common/dto/media-matching.dto';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType | null = null;
  private readonly submagicApiKey = 'submagic:apiKey';
    private readonly openAiApiKey = 'openai:apiKey';

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    console.log("URL:", url);
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

  async setSubmagicApiKey(apiKey: string): Promise<void> {
    if (!apiKey || !apiKey.trim()) return;
    if (!this.client) throw new Error('Redis client is not connected');
    await this.client.set(this.submagicApiKey, apiKey.trim());
  }

  async getSubmagicApiKey(): Promise<string | undefined> {
    if (!this.client) throw new Error('Redis client is not connected');
    const val = (await this.client.get(this.submagicApiKey)) as string | null;
    if (typeof val === 'string' && val.trim() !== '') return val;
    return undefined;
  }

   async setOpenAiApiKey(apiKey: string): Promise<void> {
    if (!apiKey || !apiKey.trim()) return;
    if (!this.client) throw new Error('Redis client is not connected');
    await this.client.set(this.openAiApiKey, apiKey.trim());
  }

  async getOpenAiApiKey(): Promise<string | undefined> {
    if (!this.client) throw new Error('Redis client is not connected');
    const val = (await this.client.get(this.openAiApiKey)) as string | null;
    if (typeof val === 'string' && val.trim() !== '') return val;
    return undefined;
  }

  async saveMediaItems(mediaItems: MediaItemDto[]): Promise<void> {
    if (!this.client) throw new Error('Redis client is not connected');
    await this.client.set('mediaItems', JSON.stringify(mediaItems));
  }

  async getMediaItems(): Promise<MediaItemDto[] | undefined> {
    if (!this.client) throw new Error('Redis client is not connected');
    const val = (await this.client.get('mediaItems')) as string | null;
    if (typeof val === 'string' && val.trim() !== '') return JSON.parse(val);
    return undefined;
  }


}
