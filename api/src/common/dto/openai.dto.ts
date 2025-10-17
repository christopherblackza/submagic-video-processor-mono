import { IsString, IsArray, ValidateNested, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class MediaItemDto {
  @ApiProperty({ description: 'Unique identifier for the media item' })
  @IsString()
  userMediaId: string;

  @ApiProperty({ description: 'Description of the media content' })
  @IsString()
  description: string;
}

export class MediaMatchingDto {
  @ApiProperty({ description: 'Project ID to analyze' })
  @IsString()
  projectId: string;

  @ApiProperty({ 
    description: 'Array of available media items',
    type: [MediaItemDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  mediaItems: MediaItemDto[];

  @ApiProperty({ 
    description: 'Optional context or instructions for matching',
    required: false 
  })
  @IsOptional()
  @IsString()
  context?: string;
}

export class MediaMatchResultDto {
  @ApiProperty({ description: 'Media item ID' })
  @IsString()
  userMediaId: string;

  @ApiProperty({ description: 'Start time in seconds' })
  @IsNumber()
  startTime: number;

  @ApiProperty({ description: 'End time in seconds' })
  @IsNumber()
  endTime: number;

  @ApiProperty({ description: 'Confidence score (0-1)' })
  @IsNumber()
  confidence: number;

  @ApiProperty({ description: 'Matched text from the video' })
  @IsString()
  matchedText: string;
}

export class MediaMatchingResponseDto {
  @ApiProperty({ 
    description: 'Array of matched media items with timing',
    type: [MediaMatchResultDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaMatchResultDto)
  matches: MediaMatchResultDto[];

  @ApiProperty({ description: 'Total number of matches found' })
  @IsNumber()
  totalMatches: number;
}