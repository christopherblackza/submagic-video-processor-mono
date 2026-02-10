import { Controller, Post, Body, Get, UseGuards, Request, Delete, Param, Patch } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';

@Controller('api-keys')
@UseGuards(SupabaseAuthGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  async createApiKey(@Request() req, @Body() body: { keyName: string; keyValue: string }) {
    const userId = req.user.id;
    return this.apiKeysService.storeApiKey(userId, body.keyName, body.keyValue);
  }

  @Patch(':id/rotate')
  async rotateApiKey(@Request() req, @Param('id') id: string, @Body() body: { keyValue: string }) {
    const userId = req.user.id;
    return this.apiKeysService.rotateApiKey(userId, id, body.keyValue);
  }

  @Get()
  async getApiKeys(@Request() req) {
    const userId = req.user.id;
    return this.apiKeysService.getApiKeys(userId);
  }

  @Delete(':id')
  async deleteApiKey(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    return this.apiKeysService.deleteApiKey(userId, id);
  }
}
