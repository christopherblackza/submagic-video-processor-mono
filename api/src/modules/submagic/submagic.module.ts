import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SubmagicController } from './submagic.controller';
import { SubmagicService } from './submagic.service';
import { RedisModule } from '../redis/redis.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { UsageModule } from '../usage/usage.module';
import { ProjectService } from '../project/project.service';

@Module({
  imports: [HttpModule, RedisModule, ApiKeysModule, UsageModule],
  controllers: [SubmagicController],
  providers: [SubmagicService, ProjectService],
  exports: [SubmagicService, ProjectService],
})
export class SubmagicModule {}
