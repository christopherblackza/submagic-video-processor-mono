import { 
  Controller, 
  Post, 
  Get,
  Body, 
  Param,
  Headers,
  UseInterceptors, 
  UploadedFiles,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
  Res,
  Render,
  UseGuards,
  Request
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { BatchService } from './batch.service';
import { BatchStartDto } from '../../common/dto/start-project.dto';
import { formatDate } from '../../common/utils/helpers';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { ProjectService } from '../project/project.service';

@ApiTags('Batch Processing')
@ApiBearerAuth()
@Controller('batch')
@UseGuards(SupabaseAuthGuard)
export class BatchController {
  private readonly logger = new Logger(BatchController.name);

  constructor(
    private readonly batchService: BatchService,
    private readonly projectService: ProjectService,
  ) {}

  @Post('start')
  @ApiOperation({ summary: 'Start batch video processing' })
  @ApiResponse({ status: 200, description: 'Batch started successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async startBatch(
    @Request() req,
    @Body() dto: BatchStartDto
  ) {
    this.logger.log('Starting batch processing');
    const userId = req.user.id;
    const token = req.token;

    console.log("DTO: ", dto);
    this.logger.log("DTO: ", dto);

    // Validate that we have videos in the array
    if (!dto.videos || dto.videos.length === 0) {
      throw new BadRequestException('Videos array must contain at least one video');
    }

    // Validate that each video has a URL (since we're only handling JSON now)
    const hasValidVideos = dto.videos.some((video) => {
      const hasUrl = video.videoUrl && video.videoUrl.trim() !== '';
      return hasUrl;
    });

    if (!hasValidVideos) {
      throw new BadRequestException('Each video must have a video URL');
    }

    const result = await this.batchService.startBatch(dto, userId, token);
    
    this.logger.log(`Batch ${result.batchId} started with ${result.projectIds.length} projects`);
    return result;
  }

  @Get(':batchId')
  @ApiOperation({ summary: 'Get batch processing status page' })
  @ApiParam({ name: 'batchId', description: 'Batch ID' })
  @ApiResponse({ status: 200, description: 'Batch status page' })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  async getBatchStatus(@Param('batchId') batchId: string, @Res() res: Response, @Request() req) {
    // this.logger.log(`Getting batch status for ${batchId}`);
    
    const batch = await this.projectService.syncBatchStatus(batchId);
    console.log('BATCH', batch);
    if (!batch) {
      throw new NotFoundException('Batch not found');
    }

    if (batch.userId && batch.userId !== req.user.id) {
      throw new ForbiddenException('You do not have permission to view this batch');
    }

    // Calculate progress
    const totalProjects = batch.totalCount;
    const completedProjects = batch.completedCount;
    const failedProjects = batch.failedCount;
    const processingProjects = totalProjects - completedProjects - failedProjects;
    const progressPercentage = totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100) : 0;

    // Check if all projects are complete
    const allComplete = completedProjects + failedProjects === totalProjects;
    const hasIncompleteProjects = processingProjects > 0;

    // Format project data for display
    const formattedProjects = batch.projects.map(project => ({
      ...project,
      formattedCreatedAt: formatDate(project.createdAt),
    }));

    const templateData = {
      batch: {
        ...batch,
        formattedCreatedAt: formatDate(batch.createdAt),
      },
      projects: formattedProjects,
      stats: {
        totalProjects,
        completedProjects,
        failedProjects,
        processingProjects,
        progressPercentage,
        allComplete,
        hasIncompleteProjects,
      },
    };

    // For API responses, return JSON
    if (res.req.headers.accept?.includes('application/json')) {
      return res.json(templateData);
    }

    // For browser requests, render HTML (if we had templates configured)
    // For now, return JSON with a note about HTML rendering
    return res.json({
      ...templateData,
      note: 'HTML rendering would be available with view engine configuration',
    });
  }
}
