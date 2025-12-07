import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { OpenAIModule } from '../openai/openai.module';
import { StorageModule } from '../storage/storage.module';
import { RedisService } from '../redis/redis.service';
import { SubmagicService } from '../submagic/submagic.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule,OpenAIModule, StorageModule],
  controllers: [WebhookController],
  providers: [WebhookService, RedisService, SubmagicService],
  exports: [SubmagicService]
})
export class WebhookModule {}