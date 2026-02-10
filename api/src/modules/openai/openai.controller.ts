import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OpenAIService } from './openai.service';
import { 
  MediaMatchingRequestDto, 
  MediaMatchingResponseDto, 
  UpdateProjectRequestDto 
} from '../../common/dto/media-matching.dto';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';

@ApiTags('OpenAI')
@ApiBearerAuth()
@Controller('openai')
@UseGuards(SupabaseAuthGuard)
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
  async analyzeMediaMatching(@Request() req, @Body() request: MediaMatchingRequestDto): Promise<MediaMatchingResponseDto> {
    const userId = req.user.id;
    const token = req.token;
    return this.openaiService.analyzeProjectForMediaMatching(request, userId, token);
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
  async updateProject(
    @Request() req,
    @Body() request: UpdateProjectRequestDto
  ): Promise<any> {
    const userId = req.user.id;
    const token = req.token;
    return this.openaiService.updateProject(request, userId, token);
  }
}
