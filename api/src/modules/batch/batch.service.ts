import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SubmagicService } from '../submagic/submagic.service';
import { StorageService } from '../storage/storage.service';
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

@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);

  constructor(
    private readonly submagicService: SubmagicService,
    private readonly storageService: StorageService,
  ) {}

  async startBatch(dto: BatchStartDto): Promise<{ batchId: string; projectIds: string[] }> {
    const batchId = this.generateBatchId();
    const projectIds: string[] = [];
    const batchProjects: BatchProject[] = [];
    let failedCount = 0;

    this.logger.log(`Starting batch ${batchId} with ${dto.videos.length} videos`);

    // Process videos from the videos array (JSON only, no files)
    for (let i = 0; i < dto.videos.length; i++) {
      const video = dto.videos[i];
      
      this.logger.log(`Processing video ${i + 1}/${dto.videos.length}: "${video.title}"`);
      
      if (!video.videoUrl || video.videoUrl.trim() === '') {
        this.logger.warn(`Video at index ${i} has no URL, skipping`);
        continue;
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
          magicBrolls: false, // Set to false to allow later B-roll updates
          magicBrollsPercentage: dto.magicBrollsPercentage,
          dictionary: dto.dictionary,
        };

        const projectResult = await this.submagicService.startProject(projectDto);
        projectIds.push(projectResult.projectId);

        // Create project record
        const project: Project = {
          id: projectResult.projectId,
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
        };

        console.log("SAVING PROJECT:", project);
        this.storageService.saveProject(project);

        // Create batch project record
        batchProjects.push({
          id: projectResult.projectId,
          title: video.title,
          status: 'processing',
          createdAt: new Date().toISOString(),
        });

        this.logger.log(`✅ Successfully started project ${projectResult.projectId} for video "${video.title}"`);

      } catch (error) {
        failedCount++;
        let errorMessage = 'Unknown error';
        let errorCode = 'UNKNOWN_ERROR';
        
        // Handle specific Submagic API errors
        if (error instanceof InsufficientCreditsException) {
          errorMessage = 'Insufficient API credits';
          errorCode = 'INSUFFICIENT_CREDITS';
          this.logger.error(`❌ Failed to process video ${i + 1} ("${video.title}"): ${errorMessage}`);
          // Immediately throw the error instead of continuing
          throw error;
        } else if (error instanceof InvalidRequestException) {
          errorMessage = 'Invalid request parameters';
          errorCode = 'INVALID_REQUEST';
          this.logger.error(`❌ Failed to process video ${i + 1} ("${video.title}"): ${errorMessage}`);
          throw error;
        } else if (error instanceof UnauthorizedException) {
          errorMessage = 'Unauthorized access to Submagic API';
          errorCode = 'UNAUTHORIZED';
          this.logger.error(`❌ Failed to process video ${i + 1} ("${video.title}"): ${errorMessage}`);
          throw error;
        } else if (error instanceof RateLimitExceededException) {
          errorMessage = 'Rate limit exceeded';
          errorCode = 'RATE_LIMIT_EXCEEDED';
          this.logger.error(`❌ Failed to process video ${i + 1} ("${video.title}"): ${errorMessage}`);
          throw error;
        } else if (error instanceof SubmagicServerException) {
          errorMessage = 'Submagic API server error';
          errorCode = 'SUBMAGIC_SERVER_ERROR';
          this.logger.error(`❌ Failed to process video ${i + 1} ("${video.title}"): ${errorMessage}`);
          throw error;
        } else if (error instanceof SubmagicApiException) {
          errorMessage = error.message;
          errorCode = error.errorCode || 'SUBMAGIC_API_ERROR';
          this.logger.error(`❌ Failed to process video ${i + 1} ("${video.title}"): ${errorMessage}`);
          throw error;
        } else {
          errorMessage = error.message || 'Unknown error';
          this.logger.error(`❌ Failed to process video ${i + 1} ("${video.title}"):`, error.message);
        }
        
        // Add failed project to batch for tracking (only for non-API errors)
        batchProjects.push({
          id: `failed-${i}`,
          title: video.title,
          status: 'failed',
          error: errorMessage,
          errorCode,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Create batch record even if some projects failed
    const batch: Batch = {
      id: batchId,
      createdAt: new Date().toISOString(),
      projects: batchProjects,
      totalCount: batchProjects.length,
      completedCount: 0,
      failedCount,
      status: 'processing',
    };

    this.storageService.saveBatch(batch);

    const successfulProjects = projectIds.length;
    this.logger.log(`🎉 Batch ${batchId} completed: ${successfulProjects} successful, ${failedCount} failed`);
     
     return { 
       batchId, 
       projectIds
     };
  }

  private generateBatchId(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(16).toString('hex');
  }
}