import { Module } from '@nestjs/common';
import { BatchController } from './batch.controller';
import { BatchService } from './batch.service';
import { SubmagicModule } from '../submagic/submagic.module';

@Module({
  imports: [SubmagicModule],
  controllers: [BatchController],
  providers: [BatchService],
})
export class BatchModule {}