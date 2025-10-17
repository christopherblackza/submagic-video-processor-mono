import { 
  Controller, 
  Post, 
  Body, 
  Logger,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { WebhookService } from './webhook.service';
import { WebhookDto } from '../../common/dto/webhook.dto';

@ApiTags('Webhooks')
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  @Post('submagic')
  // @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Handle Submagic webhook notifications' })
  // @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  // @ApiResponse({ status: 400, description: 'Invalid webhook payload' })
  // @ApiBody({ type: WebhookDto })
  async handleSubmagicWebhook(@Body() payload: any) {
    this.logger.log('Received Submagic webhook');
    this.logger.log(`Full webhook payload: ${JSON.stringify(payload, null, 2)}`);
    this.logger.log(`Webhook headers would be logged here if needed`);

    // Try to process with existing service, but catch any errors
    try {
      await this.webhookService.processWebhook(payload);
    } catch (error) {
      this.logger.error('Error processing webhook:', error);
      // Still return success to Submagic so they don't retry
    }

    return { status: 'ok', message: 'Webhook processed successfully' };
  }
}