import { Module } from '@nestjs/common';
import { BatchController } from './batch.controller';
import { BatchService } from './batch.service';
import { SubmagicModule } from '../submagic/submagic.module';
import { ProjectService } from '../project/project.service';

@Module({
  imports: [SubmagicModule],
  controllers: [BatchController],
  providers: [BatchService, ProjectService],
})
export class BatchModule {}