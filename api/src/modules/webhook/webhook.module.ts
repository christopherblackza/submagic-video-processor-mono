import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { OpenAIModule } from '../openai/openai.module';
import { StorageModule } from '../storage/storage.module';
import { RedisService } from '../redis/redis.service';

@Module({
  imports: [OpenAIModule, StorageModule],
  controllers: [WebhookController],
  providers: [WebhookService, RedisService],
})
export class WebhookModule {}