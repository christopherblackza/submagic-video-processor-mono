import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { OpenAIService } from '../openai/openai.service';
import { WebhookDto } from '../../common/dto/webhook.dto';
import { CompletionData } from '../../common/interfaces/project.interface';
import { MEDIA_ITEMS } from '../../common/constants/media-items';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly openaiService: OpenAIService,
  ) {}

  async processWebhook(payload: WebhookDto): Promise<void> {
    const projectId = payload.projectId;
    
    if (!projectId) {
      this.logger.warn('Webhook received without projectId or id');
      return;
    }

    this.logger.log(`Processing webhook for project ${projectId}`);

    // Store completion data
    const completionData: CompletionData = {
      projectId,
      status: payload.status || 'unknown',
      downloadUrl: payload.downloadUrl,
      receivedAt: new Date().toISOString(),
    };

    this.storageService.saveCompletion(completionData);

    // Update project status
    const project = this.storageService.getProject(projectId);
    if (project) {
      const updatedProject = this.storageService.updateProject(projectId, {
        status: payload.status || 'completed',
        completedAt: new Date().toISOString(),
      });

      this.logger.log(`Updated project ${projectId} status to ${payload.status}`);

      // If project is completed, trigger OpenAI media matching
      if (payload.status === 'completed') {
        try {
          this.logger.log(`Starting OpenAI media matching for project ${projectId}`);
          
          // Call analyze-media-matching endpoint
          const analysisResult = await this.openaiService.analyzeProjectForMediaMatching({
            projectId,
            mediaItems: MEDIA_ITEMS,
            confidenceThreshold: 0.7,
          });

          this.logger.log(`Media matching analysis completed for project ${projectId}. Found ${analysisResult.totalMatches} matches`);

          // If matches were found, call analyze-and-update endpoint
          if (analysisResult.matches.length > 0) {
            // const updateResult = await this.openaiService.analyzeAndUpdateProject(
            //   projectId,
            //   MEDIA_ITEMS,
            //   0.7
            // );

            // this.logger.log(`Successfully updated project ${projectId} with media matches:`, updateResult);
          } else {
            this.logger.log(`No media matches found for project ${projectId}`);
          }
        } catch (error) {
          this.logger.error(`Error processing OpenAI media matching for project ${projectId}:`, error);
          // Don't throw error to avoid webhook retry loops
        }
      }

      // If project is part of a batch, update batch status
      if (updatedProject?.batchId) {
        this.updateBatchStatus(updatedProject.batchId, projectId, payload.status || 'completed');
      }
    } else {
      this.logger.warn(`Project ${projectId} not found in storage`);
    }
  }

  private updateBatchStatus(batchId: string, projectId: string, status: string): void {
    this.logger.log(`Updating batch ${batchId} for project ${projectId} with status ${status}`);

    // Update the batch project status
    this.storageService.updateBatchProjectStatus(batchId, projectId, status);

    // Check if batch is complete
    const batch = this.storageService.getBatch(batchId);
    if (batch) {
      const totalProjects = batch.totalCount;
      const completedProjects = batch.completedCount;
      const failedProjects = batch.failedCount;
      const finishedProjects = completedProjects + failedProjects;

      if (finishedProjects >= totalProjects) {
        this.storageService.updateBatch(batchId, {
          status: failedProjects > 0 ? 'completed_with_errors' : 'completed',
        });
        this.logger.log(`Batch ${batchId} completed: ${completedProjects} successful, ${failedProjects} failed`);
      }
    }
  }
}