import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { UserMediaController } from './user-media.controller';
import { UserMediaService } from './user-media.service';

@Module({
  imports: [SupabaseModule],
  controllers: [UserMediaController],
  providers: [UserMediaService],
  exports: [UserMediaService],
})
export class UserMediaModule {}
