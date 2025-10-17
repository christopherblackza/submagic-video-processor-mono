import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { SubmagicModule } from '../submagic/submagic.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [SubmagicModule, StorageModule],
  controllers: [ProjectController],
})
export class ProjectModule {}