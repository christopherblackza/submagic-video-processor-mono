import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SubmagicController } from './submagic.controller';
import { SubmagicService } from './submagic.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [HttpModule, RedisModule],
  controllers: [SubmagicController],
  providers: [SubmagicService],
  exports: [SubmagicService],
})
export class SubmagicModule {}
