import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { Project, Batch, CompletionData, BatchProject } from '../../common/interfaces/project.interface';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private async withRetry<T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === retries - 1) throw error;
        // Retry on connection errors or 5xx
        const isRetryable = error.message?.includes('connection') || error.status >= 500 || error.code === 'ETIMEDOUT';
        if (!isRetryable) throw error;
        
        this.logger.warn(`Operation failed, retrying (${i + 1}/${retries}): ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
    throw new Error('Operation failed after retries');
  }

  // Project methods
  async saveProject(project: Project): Promise<void> {
    await this.withRetry(async () => {
      try {
        const client = this.supabaseService.getServiceRoleClient();
        
        // 1. Save to 'projects' table (Source of Truth for Project Metadata)
        const projectData = {
          id: project.id,
          user_id: project.userId,
          name: project.title,
          status: project.status || 'pending',
          created_at: project.createdAt,
          updated_at: new Date().toISOString(),
          metadata: {
            originalTitle: project.originalTitle,
            language: project.language,
            templateName: project.templateName,
            videoUrl: project.videoUrl,
            webhookUrl: project.webhookUrl,
            magicZooms: project.magicZooms,
            magicBrolls: project.magicBrolls,
            magicBrollsPercentage: project.magicBrollsPercentage,
            dictionary: project.dictionary,
            batchId: project.batchId,
            error: project.error,
            uploadStatus: project.uploadStatus,
            completedAt: project.completedAt,
          }
        };

        const { error: projectError } = await client
          .from('projects')
          .upsert(projectData)
          .select()
          .single();

        if (projectError) throw projectError;
        this.logger.debug(`Saved project ${project.id} to 'projects' table`);

        console.log("WEBHOOK URL:", project.webhookUrl);

        // 2. Sync with 'jobs' table for processing (if needed)
        // Only create/update job if status implies processing needed or it's a new request
        // We'll upsert to ensure the job exists for the webhook to pick up
        const jobData = {
          user_id: project.userId,
          job_type: 'video_processing',
          status: project.status || 'pending',
          parameters: {
            projectId: project.id,
            title: project.title,
            originalTitle: project.originalTitle,
            language: project.language,
            templateName: project.templateName,
            videoUrl: project.videoUrl,
            webhookUrl: project.webhookUrl,
            magicZooms: project.magicZooms,
            magicBrolls: project.magicBrolls,
            magicBrollsPercentage: project.magicBrollsPercentage,
            dictionary: project.dictionary,
            batchId: project.batchId,
          },
          error_logs: project.error,
          created_at: project.createdAt,
          completed_at: project.completedAt,
        };

        // Check if job exists to preserve ID if possible, or just insert/update based on projectId match?
        // Jobs table doesn't have projectId as PK. 
        // We need to find the job associated with this project.
        const { data: existingJob } = await client
            .from('jobs')
            .select('id')
            .contains('parameters', { projectId: project.id })
            .limit(1)
            .maybeSingle();

        if (existingJob) {
            const { error: jobError } = await client
                .from('jobs')
                .update(jobData)
                .eq('id', existingJob.id);
            if (jobError) throw jobError;
            this.logger.debug(`Updated job for project ${project.id}`);
        } else {
            const { error: jobError } = await client
                .from('jobs')
                .insert(jobData);
            if (jobError) throw jobError;
            this.logger.debug(`Created new job for project ${project.id}`);
        }

      } catch (error) {
        this.logger.error(`Failed to save project ${project.id}: ${error.message}`, error.stack);
        throw new InternalServerErrorException('Failed to save project');
      }
    });
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.withRetry(async () => {
      try {
        const client = this.supabaseService.getServiceRoleClient();
        const { data, error } = await client
          .from('projects')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
            if (error.code === 'PGRST116') return undefined; // Not found
            throw error;
        }
        
        return this.mapDbProjectToProject(data);
      } catch (error) {
        this.logger.error(`Failed to get project ${id}: ${error.message}`, error.stack);
        throw new InternalServerErrorException('Failed to get project');
      }
    });
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    try {
      const project = await this.getProject(id);
      if (!project) return undefined;

      const updatedProject = { ...project, ...updates };
      await this.saveProject(updatedProject);
      return updatedProject;
    } catch (error) {
      this.logger.error(`Failed to update project ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to update project');
    }
  }

  async getAllProjects(): Promise<Project[]> {
    return this.withRetry(async () => {
      try {
        const client = this.supabaseService.getServiceRoleClient();
        const { data, error } = await client
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data.map(p => this.mapDbProjectToProject(p));
      } catch (error) {
        this.logger.error(`Failed to get all projects: ${error.message}`, error.stack);
        throw new InternalServerErrorException('Failed to get all projects');
      }
    });
  }

  // Batch methods
  async saveBatch(batch: Batch): Promise<void> {
    // We save individual projects. 
    // Ideally we should have a 'batches' table too, but prompt didn't ask for it specifically 
    // and 'projects' table has metadata. 
    // We'll iterate and save projects.
    for (const p of batch.projects) {
        const project: Project = {
            id: p.id,
            userId: batch.userId,
            title: p.title,
            language: batch.language || 'en',
            templateName: batch.templateName || 'Unknown',
            status: p.status || 'pending',
            createdAt: p.createdAt,
            batchId: batch.id,
            error: p.error,
            completedAt: p.status === 'completed' ? new Date().toISOString() : undefined
        };
        await this.saveProject(project);
    }
    this.logger.debug(`Processed batch ${batch.id} save request`);
  }

  async getBatch(id: string): Promise<Batch | undefined> {
    return this.withRetry(async () => {
      try {
        const client = this.supabaseService.getServiceRoleClient();
        // Query projects by batchId in metadata
        const { data: projects, error } = await client
          .from('projects')
          .select('*')
          .contains('metadata', { batchId: id });

        if (error) throw error;
        if (!projects || projects.length === 0) return undefined;

        const mappedProjects = projects.map(p => this.mapDbProjectToProject(p));
        console.log("MAPPED PROJECTS", mappedProjects);
        return this.reconstructBatch(id, mappedProjects);
      } catch (error) {
        this.logger.error(`Failed to get batch ${id}: ${error.message}`, error.stack);
        throw new InternalServerErrorException('Failed to get batch');
      }
    });
  }

  async updateBatch(id: string, updates: Partial<Batch>): Promise<Batch | undefined> {
      // Re-fetch batch
      return this.getBatch(id);
  }

  async getAllBatches(): Promise<Batch[]> {
     return []; // Not implemented fully as it requires scanning all projects or a batches table
  }

  // Completion methods
  async saveCompletion(completion: CompletionData): Promise<void> {
    return this.withRetry(async () => {
        try {
            const client = this.supabaseService.getServiceRoleClient();
            
            // Update project in 'projects' table
            const { data: project } = await client
                .from('projects')
                .select('*')
                .eq('id', completion.projectId)
                .single();
                
            if (project) {
                const metadata = project.metadata || {};
                const updatedMetadata = {
                    ...metadata,
                    result: completion,
                    completedAt: new Date().toISOString()
                };
                
                const { error } = await client
                    .from('projects')
                    .update({
                        status: 'completed',
                        updated_at: new Date().toISOString(),
                        metadata: updatedMetadata
                    })
                    .eq('id', completion.projectId);
                    
                if (error) throw error;
            }
            
            // Also update job if it exists
             const { data: existingJob } = await client
                .from('jobs')
                .select('id')
                .contains('parameters', { projectId: completion.projectId })
                .limit(1)
                .maybeSingle();

             if (existingJob) {
                 await client.from('jobs').update({
                     result: completion,
                     completed_at: new Date().toISOString(),
                     status: 'completed'
                 }).eq('id', existingJob.id);
             }

        } catch (error) {
             this.logger.error(`Failed to save completion: ${error.message}`);
             throw new InternalServerErrorException('Failed to save completion');
        }
    });
  }

  async getCompletion(projectId: string): Promise<CompletionData | undefined> {
    return this.withRetry(async () => {
        try {
          const project = await this.getProject(projectId);
          if (!project) return undefined;
          
          // Check metadata for result
          // Assuming 'any' cast for metadata property access
          const metadata = (project as any).dictionary || {}; // Wait, dictionary is not metadata. 
          // In mapDbProjectToProject, we extract dictionary from metadata.
          // We need to access the raw metadata or map the result field.
          
          // Let's look at mapDbProjectToProject to see where we put 'result'.
          // I haven't written mapDbProjectToProject yet in this thought block.
          // I will ensure mapDbProjectToProject includes 'result' in the returned Project object if needed, 
          // or I query it here.
          
          // Let's query directly to get the result from metadata
          const client = this.supabaseService.getServiceRoleClient();
          const { data, error } = await client
              .from('projects')
              .select('metadata')
              .eq('id', projectId)
              .single();
              
          if (error || !data) return undefined;
          
          const result = data.metadata?.result;
          if (result) {
               return {
                   projectId: projectId,
                   status: 'completed', // if result exists
                   receivedAt: data.metadata.completedAt || new Date().toISOString(),
                   downloadUrl: result.downloadUrl || result.videoUrl || result.output || result.url,
                   thumbnailUrl: result.thumbnailUrl,
                   duration: result.duration,
                   fileSize: result.fileSize
               };
          }
          return undefined;
        } catch (error) {
           return undefined;
        }
    });
  }
  
  // Sync methods
  async syncProjectStatus(projectId: string): Promise<Project | undefined> {
      return this.withRetry(async () => {
          let project = await this.getProject(projectId);
          if (!project) return undefined;
          
          if (project.status === 'completed' || project.status === 'failed') {
              return project;
          }
          
          // Check 'jobs' table for updates
          const client = this.supabaseService.getServiceRoleClient();
          const { data: job } = await client
            .from('jobs')
            .select('status, result, error_logs, completed_at')
            .contains('parameters', { projectId: projectId })
            .limit(1)
            .maybeSingle();
            
          if (job && job.status !== project.status) {
              this.logger.log(`Syncing project ${projectId} status from ${project.status} to ${job.status}`);
              
              // Update 'projects' table
              const updates: any = {
                  status: job.status,
                  updated_at: new Date().toISOString()
              };
              
              // Update metadata with result/error
              // We need to fetch current metadata first or use jsonb_set (but simple update merges top-level keys in some clients, but Supabase/Postgres replace jsonb by default unless merged)
              // We'll fetch the project again to get metadata or use the one we have if we trust it hasn't changed
              
              const { data: currentProject } = await client
                  .from('projects')
                  .select('metadata')
                  .eq('id', projectId)
                  .single();
                  
              if (currentProject) {
                  const newMetadata = {
                      ...currentProject.metadata,
                      result: job.result,
                      error: job.error_logs,
                      completedAt: job.completed_at
                  };
                  updates.metadata = newMetadata;
                  
                  await client.from('projects').update(updates).eq('id', projectId);
                  
                  // Return updated project
                  project = await this.getProject(projectId);
              }
          }
          
          return project;
      });
  }

  async syncBatchStatus(batchId: string): Promise<Batch | undefined> {
      // For batch, we just re-fetch, which re-queries projects
      return this.getBatch(batchId);
  }

  async getProjectsByBatch(batchId: string): Promise<Project[]> {
      const batch = await this.getBatch(batchId);
      if (!batch) return [];
      
      // Batch object has 'projects' property but it's BatchProject[]. 
      // We want full Project objects.
      // We can query them.
      const client = this.supabaseService.getServiceRoleClient();
      const { data, error } = await client
          .from('projects')
          .select('*')
          .contains('metadata', { batchId: batchId });
          
      if (error) return [];
      return data.map(p => this.mapDbProjectToProject(p));
  }

  // Private helpers
  private mapDbProjectToProject(dbProject: any): Project {
      const metadata = dbProject.metadata.result.raw || {};
      console.log("METADATA", metadata);
      return {
          id: dbProject.id,
          userId: dbProject.user_id,
          title: dbProject.name,
          status: dbProject.status,
          createdAt: dbProject.created_at,
          // Map metadata fields
          originalTitle: metadata.originalTitle,
          language: metadata.language,
          templateName: metadata.templateName,
          videoUrl: metadata.videoUrl,
          webhookUrl: metadata.webhookUrl,
          magicZooms: metadata.magicZooms,
          magicBrolls: metadata.magicBrolls,
          magicBrollsPercentage: metadata.magicBrollsPercentage,
          dictionary: metadata.dictionary,
          batchId: metadata.batchId,
          error: metadata.error,
          completedAt: metadata.completedAt,
          previewUrl: metadata.previewUrl
      };
  }
  
  private reconstructBatch(batchId: string, projects: Project[]): Batch {
     if (!projects || projects.length === 0) return undefined as any;
     
     const firstProject = projects[0];
     
     const batchProjects: BatchProject[] = projects.map(p => ({
         id: p.id,
         title: p.title,
         status: p.status,
         error: p.error,
         errorCode: p.error ? 'ERROR' : undefined,
         createdAt: p.createdAt,
         previewUrl: p.previewUrl
     }));

     const completedCount = projects.filter(p => p.status === 'completed').length;
     const failedCount = projects.filter(p => p.status === 'failed').length;
     const totalCount = projects.length;
     
     let status = 'processing';
     if (completedCount + failedCount === totalCount) {
         status = failedCount > 0 ? 'completed_with_errors' : 'completed';
     }

     return {
         id: batchId,
         userId: firstProject.userId,
         createdAt: firstProject.createdAt,
         projects: batchProjects,
         totalCount: totalCount,
         completedCount: completedCount,
         failedCount: failedCount,
         status: status,
         language: firstProject.language,
         templateName: firstProject.templateName,
         magicZooms: firstProject.magicZooms,
         magicBrolls: firstProject.magicBrolls,
         magicBrollsPercentage: firstProject.magicBrollsPercentage
     };
  }
}
