import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { SubmagicModule } from '../submagic/submagic.module';
import { ProjectService } from './project.service';

@Module({
  imports: [SubmagicModule],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}