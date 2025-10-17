import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl, IsArray, IsISO8601 } from 'class-validator';

export class WebhookDto {
  @ApiPropertyOptional({ description: 'Project ID' })
  @IsOptional()
  @IsString()
  projectId?: string;


  @ApiPropertyOptional({ description: 'Project status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Download URL' })
  @IsOptional()
  @IsUrl()
  downloadUrl?: string;

  @ApiPropertyOptional({ description: 'Timestamp when the webhook was sent', example: '2024-01-15T10:45:00.000Z' })
  @IsOptional()
  @IsISO8601()
  timestamp?: string;
}