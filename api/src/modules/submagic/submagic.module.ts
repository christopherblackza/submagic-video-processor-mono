import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SubmagicController } from './submagic.controller';
import { SubmagicService } from './submagic.service';

@Module({
  imports: [HttpModule],
  controllers: [SubmagicController],
  providers: [SubmagicService],
  exports: [SubmagicService],
})
export class SubmagicModule {}