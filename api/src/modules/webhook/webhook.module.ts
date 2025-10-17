import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { OpenAIModule } from '../openai/openai.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [OpenAIModule, StorageModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}