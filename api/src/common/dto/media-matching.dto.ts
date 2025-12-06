import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsNumber, IsOptional, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class MediaItemDto {
  @ApiProperty({ description: 'Unique identifier for the media item' })
  @IsString()
  userMediaId: string;

  @ApiProperty({ description: 'Description of the media content' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Tags for the media item' })
  @IsOptional()
  @IsArray()
  tags?: string[];

  // used boolean
  @ApiProperty({ description: 'Whether the media item has been used in a match' })
  @IsOptional()
  @IsBoolean()
  used?: boolean;
  

}

export class MediaMatchingRequestDto {
  @ApiProperty({ description: 'Project ID to analyze' })
  @IsString()
  projectId: string;

  @ApiProperty({ 
    description: 'Array of available media items',
    type: [MediaItemDto]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  mediaItems: MediaItemDto[];

  @ApiProperty({ 
    description: 'Confidence threshold for matches (0-1)',
    required: false,
    default: 0.7
  })
  @IsOptional()
  @IsNumber()
  confidenceThreshold?: number;

  @ApiProperty({
    description: 'Override system prompt used for analysis',
    required: false
  })
  @IsOptional()
  @IsString()
  systemPrompt?: string;
}

export class MediaMatchDto {
  @ApiProperty({ description: 'Media item ID that matches' })
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

  @ApiProperty({ description: 'Reason for the match' })
  @IsString()
  reason: string;

  @ApiProperty({ description: 'Matched text segment' })
  @IsString()
  matchedText: string;

  @ApiProperty({ description: 'Description of the matched media item' })
  @IsString()
  description: string;
  
}

export class MediaMatchingResponseDto {
  @ApiProperty({ description: 'Project ID that was analyzed' })
  @IsString()
  projectId: string;

  @ApiProperty({ 
    description: 'Array of media matches found',
    type: [MediaMatchDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaMatchDto)
  matches: MediaMatchDto[];

  @ApiProperty({ description: 'Total number of matches found' })
  @IsNumber()
  totalMatches: number;

  @ApiProperty({ description: 'Processing timestamp' })
  @IsString()
  processedAt: string;
}

export class UpdateProjectRequestDto {
  @ApiProperty({ description: 'Project ID to update' })
  @IsString()
  projectId: string;

  @ApiProperty({ 
    description: 'Array of media matches to apply',
    type: [MediaMatchDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaMatchDto)
  matches: MediaMatchDto[];
}
