import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenAIService } from './openai.service';
import { OpenAIController } from './openai.controller';
import { SubmagicModule } from '../submagic/submagic.module';
import { RedisModule } from '../redis/redis.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { UsageModule } from '../usage/usage.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => SubmagicModule),
    RedisModule,
    ApiKeysModule,
    UsageModule,
    SupabaseModule,
  ],
  controllers: [OpenAIController],
  providers: [OpenAIService],
  exports: [OpenAIService],
})
export class OpenAIModule {}