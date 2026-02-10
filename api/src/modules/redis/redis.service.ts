import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaItemDto } from '../../common/dto/media-matching.dto';
import { createClient, RedisClientType } from 'redis';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType | null = null;
  private readonly submagicApiKey = 'submagic:apiKey';
    private readonly openAiApiKey = 'openai:apiKey';

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService
  ) {
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

  async saveMediaItems(mediaItems: MediaItemDto[], userId?: string): Promise<void> {
    if (!userId) {
      this.logger.warn('saveMediaItems called without userId, skipping Supabase save');
      return;
    }

    try {
      const client = this.supabaseService.getServiceRoleClient();
      
      const records = mediaItems.map(item => ({
        id: item.userMediaId, // Assuming userMediaId is a valid UUID
        user_id: userId,
        description: item.description,
        tags: item.tags || [],
        metadata: {} // Removed 'used' from metadata as it's now tracked in project_media_items
      }));

      const { error } = await client
        .from('user_media_items')
        .upsert(records, { onConflict: 'id' });

      if (error) {
        throw new Error(`Supabase insert error: ${error.message}`);
      }

      this.logger.log(`Saved ${mediaItems.length} media items for user ${userId} to Supabase`);
    } catch (error) {
      this.logger.error(`Failed to save media items to Supabase: ${error.message}`);
      throw error;
    }
  }

  async getMediaItems(userId?: string): Promise<MediaItemDto[] | undefined> {
    if (!userId) {
      this.logger.warn('getMediaItems called without userId, returning undefined');
      return undefined;
    }

    try {
      const client = this.supabaseService.getServiceRoleClient();
      
      // 1. Fetch user's media items
      const { data: items, error: itemsError } = await client
        .from('user_media_items')
        .select('*')
        .eq('user_id', userId);

      if (itemsError) throw new Error(`Supabase select error: ${itemsError.message}`);
      if (!items || items.length === 0) return [];

      // 2. Fetch usage counts
      const itemIds = items.map(i => i.id);
      
      const { data: usages, error: usageError } = await client
        .from('project_media_items')
        .select('user_media_item_id')
        .in('user_media_item_id', itemIds);

      if (usageError) throw new Error(`Supabase usage select error: ${usageError.message}`);

      // 3. Count usage
      const usageMap = new Map<string, number>();
      usages?.forEach(u => {
        const count = usageMap.get(u.user_media_item_id) || 0;
        usageMap.set(u.user_media_item_id, count + 1);
      });

      // 4. Map and Sort
      const result = items.map(item => ({
        userMediaId: item.id,
        description: item.description,
        tags: item.tags,
        usageCount: usageMap.get(item.id) || 0,
        storagePath: item.storage_path
      }));

      // Sort by usage count ASC (unused first)
      return result.sort((a, b) => a.usageCount - b.usageCount);

    } catch (error) {
      this.logger.error(`Failed to get media items from Supabase: ${error.message}`);
      return undefined;
    }
  }

  async recordMediaUsage(projectId: string, mediaItemIds: string[]): Promise<void> {
    if (!mediaItemIds || mediaItemIds.length === 0) return;
    
    try {
      const client = this.supabaseService.getServiceRoleClient();
      const records = mediaItemIds.map(mid => ({
        project_id: projectId,
        user_media_item_id: mid
      }));
      
      const { error } = await client
        .from('project_media_items')
        .upsert(records, { onConflict: 'project_id,user_media_item_id', ignoreDuplicates: true });
        
      if (error) throw error;
      
      this.logger.log(`Recorded usage for ${mediaItemIds.length} items in project ${projectId}`);
    } catch (error) {
       this.logger.error(`Failed to record media usage: ${error.message}`);
       // Don't throw to avoid disrupting the main workflow
    }
  }
}
