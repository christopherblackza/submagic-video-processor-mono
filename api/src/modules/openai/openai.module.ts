import { Module } from '@nestjs/common';
import { OpenAIController } from './openai.controller';
import { OpenAIService } from './openai.service';
import { SubmagicModule } from '../submagic/submagic.module';
import { RedisService } from '../redis/redis.service';

@Module({
  imports: [SubmagicModule],
  controllers: [OpenAIController],
  providers: [OpenAIService, RedisService],
  exports: [OpenAIService],
})
export class OpenAIModule {}