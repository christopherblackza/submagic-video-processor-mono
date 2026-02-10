import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { UsageService } from './usage.service';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';

@Controller('usage')
@UseGuards(SupabaseAuthGuard)
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get()
  async getUsage(@Request() req) {
    return this.usageService.getUserUsage(req.user.id);
  }
}
