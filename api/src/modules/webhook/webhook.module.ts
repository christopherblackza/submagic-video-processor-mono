import { Module } from '@nestjs/common';
import { OpenAIModule } from '../openai/openai.module';
import { RedisModule } from '../redis/redis.module';
import { SubmagicModule } from '../submagic/submagic.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule, OpenAIModule, RedisModule, SubmagicModule],
  controllers: [],
  providers: [],
})
export class WebhookModule {}