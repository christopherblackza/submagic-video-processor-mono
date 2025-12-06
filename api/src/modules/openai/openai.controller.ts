import { Controller, Post, Body, Param, HttpCode, HttpStatus, Headers, BadRequestException, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiHeader } from '@nestjs/swagger';
import { OpenAIService } from './openai.service';
import { 
  MediaMatchingRequestDto, 
  MediaMatchingResponseDto, 
  MediaItemDto,
  UpdateProjectRequestDto 
} from '../../common/dto/media-matching.dto';
import { RedisService } from '../redis/redis.service';

@ApiTags('OpenAI')
@Controller('openai')
export class OpenAIController {
  constructor(private readonly openaiService: OpenAIService,
    private redisService: RedisService
  ) {}

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
    const apiKey = await this.redisService.getOpenAiApiKey();
    if (!apiKey || apiKey.trim() === "") {
      throw new BadRequestException("OpenAI API key not found in Redis");
    }
    
    return this.openaiService.analyzeProjectForMediaMatching(request);
  }

    @Get("load-api-key")
    @ApiOperation({ summary: "Load OpenAI API key from Redis" })
    async loadApiKey() {
      const apiKey = await this.redisService.getOpenAiApiKey();
      if (!apiKey || apiKey.trim() === "") {
        throw new BadRequestException("OpenAI API key not found in Redis");
      }
      return { apiKey };
    }
  
    @Post("save-api-key")
    @ApiOperation({ summary: "Save OpenAI API key to Redis" })
    @ApiHeader({ name: "x-api-key", description: "OpenAI API key", required: true })
    async saveApiKey(@Headers("x-api-key") apiKey?: string) {
      if (!apiKey || apiKey.trim() === "") {
        throw new BadRequestException("x-api-key header is required");
      }
      await this.redisService.setOpenAiApiKey(apiKey);
      return { message: "API key saved" };
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
    @Body() request: UpdateProjectRequestDto
  ): Promise<any> {
    return this.openaiService.updateProject(request);
  }
}