import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsUrl, IsArray, IsInt, Min, Max, ValidateNested, IsDecimal, isNumber, IsNumber } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class StartProjectDto {
  @ApiPropertyOptional({ description: 'Video title', example: 'My Awesome Video' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'Language code', example: 'en' })
  @IsString()
  language: string;

  @ApiProperty({ description: 'Template name', example: 'Hormozi 2' })
  @IsString()
  templateName: string;

  @ApiPropertyOptional({ description: 'Video URL', example: 'https://example.com/video.mp4' })
  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @ApiPropertyOptional({ description: 'Webhook URL', example: 'http://localhost:3000/webhook/submagic' })
  @IsOptional()
  @IsUrl()
  webhookUrl?: string;

  @ApiPropertyOptional({ description: 'Enable magic zooms', default: true })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
    }
    return value;
  })
  magicZooms?: boolean;

  @ApiPropertyOptional({ description: 'Enable magic B-rolls', default: true })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
    }
    return value;
  })
  magicBrolls?: boolean;

  @ApiPropertyOptional({ description: 'Magic B-rolls percentage', minimum: 0, maximum: 100, default: 60 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const n = parseInt(value, 10);
      return Number.isFinite(n) ? n : undefined;
    }
    return value;
  })
  magicBrollsPercentage?: number;


  @ApiPropertyOptional({ 
    description: 'Dictionary words (comma-separated string or JSON array)', 
    example: ['Submagic', 'AI-powered', 'captions'] 
  })
  @IsOptional()
  dictionary?: string | string[];
}



export class UserMediaItemDto {
  @ApiProperty({ description: 'Start time in seconds where the user media should begin', example: 10.5 })
  @IsNumber()
  @Min(0)
  startTime: number;

  @ApiProperty({ description: 'End time in seconds where the user media should end', example: 15.2 })
  @IsNumber()
  @Min(0)
  endTime: number;

  @ApiProperty({ description: 'UUID of the user media from your library', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsString()
  userMediaId: string;
}

export class UpdateProjectDto {
  @ApiPropertyOptional({ description: 'Automatically remove silence from the video at the specified pace', enum: ['natural', 'fast', 'extra-fast'] })
  @IsOptional()
  @IsString()
  removeSilencePace?: 'natural' | 'fast' | 'extra-fast';

  @ApiPropertyOptional({ description: 'Automatically detect and remove bad takes and silence from the video using AI analysis' })
  @IsOptional()
  @IsBoolean()
  removeBadTakes?: boolean;

  @ApiPropertyOptional({ 
    description: 'Array of user media items to insert into the video',
    type: [UserMediaItemDto],
    example: [
      { startTime: 10.5, endTime: 15.2, userMediaId: '123e4567-e89b-12d3-a456-426614174000' },
      { startTime: 25.0, endTime: 30.8, userMediaId: '987fcdeb-51a2-43d7-b123-556644330099' }
    ]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserMediaItemDto)
  items?: UserMediaItemDto[];
}

export class ExportProjectDto {
  @ApiPropertyOptional({ description: 'Frames per second for the exported video (1-60)', minimum: 1, maximum: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  fps?: number;

  @ApiPropertyOptional({ description: 'Video width in pixels (100-4000)', minimum: 100, maximum: 4000 })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(4000)
  width?: number;

  @ApiPropertyOptional({ description: 'Video height in pixels (100-4000)', minimum: 100, maximum: 4000 })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(4000)
  height?: number;

  @ApiPropertyOptional({ description: 'URL to receive notification when export is complete' })
  @IsOptional()
  @IsUrl()
  webhookUrl?: string;
}

export class VideoInputDto {
  @ApiProperty({ description: 'Video title', example: 'My Awesome Video' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Video URL', example: 'https://example.com/video.mp4' })
  @IsOptional()
  @IsUrl()
  videoUrl?: string;
}

export class BatchStartDto {
  @ApiProperty({ 
    description: 'Array of videos to process',
    type: [VideoInputDto],
    example: [{ title: 'Video 1', videoUrl: 'https://example.com/video1.mp4' }]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VideoInputDto)
  videos: VideoInputDto[];

  @ApiProperty({ description: 'Language code', example: 'en' })
  @IsString()
  language: string;

  @ApiProperty({ description: 'Template name', example: 'Hormozi 2' })
  @IsString()
  templateName: string;

  @ApiPropertyOptional({ description: 'Webhook URL', example: 'http://localhost:3000/webhook/submagic' })
  @IsOptional()
  @IsUrl()
  webhookUrl?: string;

  @ApiPropertyOptional({ description: 'Enable magic zooms', default: true })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
    }
    return value;
  })
  magicZooms?: boolean;

  @ApiPropertyOptional({ description: 'Enable magic B-rolls', default: true })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
    }
    return value;
  })
  magicBrolls?: boolean;

  @ApiPropertyOptional({ description: 'Magic B-rolls percentage', minimum: 0, maximum: 100, default: 60 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return parseInt(value, 10);
    }
    return value;
  })
  magicBrollsPercentage?: number;

  @ApiPropertyOptional({ 
    description: 'Dictionary words (comma-separated string or JSON array)', 
    example: ['Submagic', 'AI-powered', 'captions'] 
  })
  @IsOptional()
  dictionary?: string | string[];
}