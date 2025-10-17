import { Controller, Post, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { OpenAIService } from './openai.service';
import { 
  MediaMatchingRequestDto, 
  MediaMatchingResponseDto, 
  MediaItemDto,
  UpdateProjectRequestDto 
} from '../../common/dto/media-matching.dto';

@ApiTags('OpenAI')
@Controller('openai')
export class OpenAIController {
  constructor(private readonly openaiService: OpenAIService) {}

  @Post('analyze-media-matching')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Analyze video content for media matching',
    description: 'Uses OpenAI to analyze video transcript and find matching B-roll media based on content relevance'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Media matching analysis completed successfully',
    type: MediaMatchingResponseDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid request parameters' 
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error during analysis' 
  })
  async analyzeMediaMatching(@Body() request: MediaMatchingRequestDto): Promise<MediaMatchingResponseDto> {
    return this.openaiService.analyzeProjectForMediaMatching(request);
  }

  @Post('analyze-and-update/:projectId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Analyze and update project with media matches',
    description: 'Analyzes video content for media matching and automatically updates the project with the matches'
  })
  @ApiParam({ 
    name: 'projectId', 
    description: 'ID of the project to analyze and update' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Project analyzed and updated successfully' 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid project ID or request parameters' 
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error during processing' 
  })
  async analyzeAndUpdateProject(
    @Param('projectId') projectId: string,
    @Body() body: { mediaItems: MediaItemDto[]; confidenceThreshold?: number }
  ): Promise<any> {
    return this.openaiService.analyzeAndUpdateProject(
      projectId, 
      body.mediaItems, 
      body.confidenceThreshold
    );
  }
}