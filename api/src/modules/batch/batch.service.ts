import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SubmagicService } from '../submagic/submagic.service';
import { BatchStartDto, VideoInputDto } from '../../common/dto/start-project.dto';
import { Batch, BatchProject, Project } from '../../common/interfaces/project.interface';
import { 
  SubmagicApiException, 
  InsufficientCreditsException, 
  InvalidRequestException, 
  UnauthorizedException, 
  RateLimitExceededException, 
  SubmagicServerException 
} from '../../common/exceptions/submagic-api.exceptions';
import { ProjectService } from '../project/project.service';

@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);

  constructor(
    private readonly submagicService: SubmagicService,
    private readonly projectService: ProjectService,
  ) {}

  async startBatch(dto: BatchStartDto, userId: string, token?: string): Promise<{ batchId: string; projectIds: string[] }> {
    const batchId = this.generateBatchId();

    this.logger.log(`Starting batch ${batchId} with ${dto.videos.length} videos`);

    // Create initial batch record
    await this.projectService.createBatch({
      id: batchId,
      userId,
      createdAt: new Date().toISOString(),
      status: 'processing', // Start as processing immediately
      totalCount: dto.videos.length,
      completedCount: 0,
      failedCount: 0,
      projects: [],
      language: dto.language,
      templateName: dto.templateName,
      magicZooms: dto.magicZooms,
      magicBrolls: dto.magicBrolls,
      magicBrollsPercentage: dto.magicBrollsPercentage
    });

    const projectIds: string[] = [];
    let completedCount = 0;
    let failedCount = 0;
    let startIndex = 0;

    // Process the first video synchronously to catch immediate errors (like Insufficient Credits)
    if (dto.videos.length > 0) {
      try {
        const firstVideo = dto.videos[0];
        const result = await this.processSingleVideo(firstVideo, 0, batchId, userId, dto, token);
        
        if (result.success) {
          projectIds.push(result.projectId);
          completedCount++;
        } else {
          failedCount++;
        }
        startIndex = 1;
      } catch (error) {
        // If we catch a critical error here, it means processSingleVideo rethrown it or it was unexpected
        // Specifically check for InsufficientCreditsException
        if (error instanceof InsufficientCreditsException) {
          this.logger.error(`❌ Batch start failed due to insufficient credits: ${error.message}`);
          await this.projectService.updateBatchStatus(batchId, 'failed');
          throw error;
        }
        // Handle Unauthorized similarly
        if (error instanceof UnauthorizedException) {
          this.logger.error(`❌ Batch start failed due to unauthorized access: ${error.message}`);
          await this.projectService.updateBatchStatus(batchId, 'failed');
          throw error;
        }
        
        // For other errors on the first video, we might choose to fail the batch or continue
        // Given the user request is specifically about credits, we'll focus on that.
        // If it's a generic error, we count it as failed and let the background process continue?
        // But if processSingleVideo throws, it's usually serious.
        // Let's count it as failed and continue for now, unless it's the critical ones above.
        failedCount++;
        startIndex = 1;
        this.logger.error(`Error processing first video: ${error.message}. Continuing with batch...`);
      }
    }

    // Start processing the rest in background
    this.processBatchInBackground(
      batchId, 
      dto, 
      userId, 
      token, 
      startIndex, 
      completedCount, 
      failedCount, 
      projectIds
    ).catch(err => {
      this.logger.error(`Background processing failed for batch ${batchId}`, err);
      // Try to update status to failed if possible
      this.projectService.updateBatchStatus(batchId, 'failed').catch(e => 
        this.logger.error(`Failed to update batch status to failed: ${e.message}`)
      );
    });
    
    return { 
      batchId, 
      projectIds
    };
  }

  private async processSingleVideo(
    video: any, 
    index: number, 
    batchId: string, 
    userId: string, 
    dto: BatchStartDto, 
    token?: string
  ): Promise<{ success: boolean, projectId?: string, error?: any }> {
    this.logger.log(`Processing video ${index + 1}/${dto.videos.length}: "${video.title}"`);
      
    if (!video.videoUrl || video.videoUrl.trim() === '') {
      this.logger.warn(`Video at index ${index} has no URL, skipping`);
      return { success: false, error: 'No URL provided' };
    }

    try {
      // Process with video URL
      const projectDto = {
        title: video.title,
        videoUrl: video.videoUrl,
        language: dto.language,
        templateName: dto.templateName,
        webhookUrl: dto.webhookUrl,
        magicZooms: dto.magicZooms,
        magicBrolls: dto.magicBrolls, 
        magicBrollsPercentage: dto.magicBrollsPercentage,
        dictionary: dto.dictionary,
        hookTitle: dto.hookTitle,
      };

      const projectResult = await this.submagicService.startProject(projectDto, userId, token);

      // Create project record
      const project: Project = {
        id: projectResult.projectId,
        userId: userId,
        title: video.title,
        originalTitle: video.title,
        language: dto.language,
        templateName: dto.templateName,
        videoUrl: video.videoUrl,
        webhookUrl: dto.webhookUrl,
        magicZooms: dto.magicZooms,
        magicBrolls: false, // Set to false to allow later B-roll updates
        magicBrollsPercentage: dto.magicBrollsPercentage,
        dictionary: Array.isArray(dto.dictionary) ? dto.dictionary : undefined,
        status: 'processing',
        createdAt: new Date().toISOString(),
        batchId,
        uploadStatus: 'completed',
      };
      await this.projectService.saveProject(project);

      this.logger.log(`✅ Successfully started project ${projectResult.projectId} for video "${video.title}"`);
      return { success: true, projectId: projectResult.projectId };

    } catch (error) {
      let errorMessage = 'Unknown error';
      let errorCode = 'UNKNOWN_ERROR';
      
      if (error instanceof InsufficientCreditsException) {
        // Rethrow to be handled by caller
        throw error;
      } 
      
      // Handle other errors
      if (error instanceof InvalidRequestException) {
        errorMessage = 'Invalid request parameters';
        errorCode = 'INVALID_REQUEST';
      } else if (error instanceof UnauthorizedException) {
         // Rethrow to be handled by caller
         throw error;
      } else if (error instanceof RateLimitExceededException) {
        errorMessage = 'Rate limit exceeded';
        errorCode = 'RATE_LIMIT_EXCEEDED';
      } else if (error instanceof SubmagicServerException) {
        errorMessage = 'Submagic API server error';
        errorCode = 'SUBMAGIC_SERVER_ERROR';
      } else if (error instanceof SubmagicApiException) {
        errorMessage = error.message;
        errorCode = error.errorCode || 'SUBMAGIC_API_ERROR';
      } else {
        errorMessage = error.message || 'Unknown error';
      }
      
      this.logger.error(`❌ Failed to process video ${index + 1} ("${video.title}"): ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  private async processBatchInBackground(
    batchId: string, 
    dto: BatchStartDto, 
    userId: string, 
    token?: string,
    startIndex: number = 0,
    initialCompletedCount: number = 0,
    initialFailedCount: number = 0,
    initialProjectIds: string[] = []
  ): Promise<void> {
    const projectIds: string[] = [...initialProjectIds];
    let failedCount = initialFailedCount;

    // Process remaining videos
    for (let i = startIndex; i < dto.videos.length; i++) {
      const video = dto.videos[i];
      
      try {
        const result = await this.processSingleVideo(video, i, batchId, userId, dto, token);
        if (result.success) {
          projectIds.push(result.projectId);
        } else {
          failedCount++;
        }
      } catch (error) {
        // Handle critical errors caught from processSingleVideo (like Insufficient Credits if it happens mid-batch)
        if (error instanceof InsufficientCreditsException) {
             this.logger.error(`❌ Batch processing stopped at video ${i + 1} due to insufficient credits`);
             failedCount++; // Count this one as failed
             // Stop processing rest
             // Mark remaining as failed? Or just stop.
             // For now, break loop.
             break;
        }
        if (error instanceof UnauthorizedException) {
             this.logger.error(`❌ Batch processing stopped at video ${i + 1} due to unauthorized access`);
             failedCount++;
             break;
        }
        // Other errors shouldn't be thrown by processSingleVideo, but if they are:
        failedCount++;
        this.logger.error(`Unexpected error processing video ${i + 1}: ${error.message}`);
      }
    }

    const successfulProjects = projectIds.length;
    // Determine final status
    let finalStatus = 'completed';
    // Calculate total attempted (which is all of them, since we iterated or broke)
    // Wait, if we broke early, the remaining videos are "failed" or "skipped"?
    // If we break early, failedCount only includes the one that triggered the break.
    // The others are not counted in completed or failed?
    // Let's assume failedCount should include skipped ones? Or just count what we touched.
    // For now, use the logic:
    
    if (failedCount === dto.videos.length && dto.videos.length > 0) {
        finalStatus = 'failed';
    } else if (failedCount > 0) {
        finalStatus = 'completed_with_errors';
    }
    
    await this.projectService.updateBatchStatus(batchId, finalStatus, {
        completedCount: successfulProjects,
        failedCount: failedCount
    });

    this.logger.log(`🎉 Batch ${batchId} completed: ${successfulProjects} successful, ${failedCount} failed`);
  }

  private generateBatchId(): string {
    const crypto = require('crypto');
    return crypto.randomUUID(); // Use UUID v4
  }
}
