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

  @Post('analyze-and-update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Update project with pre-analyzed media matches',
    description: 'Updates the project with provided media matches without performing analysis'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Project updated successfully with media matches' 
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
    @Body() request: UpdateProjectRequestDto
  ): Promise<any> {
    return this.openaiService.analyzeAndUpdateProject(request);
  }
}