import { Injectable, Logger } from '@nestjs/common';
import { Project, Batch, CompletionData } from '../../common/interfaces/project.interface';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly projects = new Map<string, Project>();
  private readonly batches = new Map<string, Batch>();
  private readonly completions = new Map<string, CompletionData>();

  // Project methods
  saveProject(project: Project): void {
    this.projects.set(project.id, project);
    this.logger.debug(`Saved project ${project.id}`);
  }

  getProject(id: string): Project | undefined {
    return this.projects.get(id);
  }

  updateProject(id: string, updates: Partial<Project>): Project | undefined {
    const project = this.projects.get(id);
    if (project) {
      const updated = { ...project, ...updates };
      this.projects.set(id, updated);
      this.logger.debug(`Updated project ${id}`);
      return updated;
    }
    return undefined;
  }

  getAllProjects(): Project[] {
    return Array.from(this.projects.values());
  }

  // Batch methods
  saveBatch(batch: Batch): void {
    this.batches.set(batch.id, batch);
    this.logger.debug(`Saved batch ${batch.id}`);
  }

  getBatch(id: string): Batch | undefined {
    return this.batches.get(id);
  }

  updateBatch(id: string, updates: Partial<Batch>): Batch | undefined {
    const batch = this.batches.get(id);
    if (batch) {
      const updated = { ...batch, ...updates };
      this.batches.set(id, updated);
      this.logger.debug(`Updated batch ${id}`);
      return updated;
    }
    return undefined;
  }

  getAllBatches(): Batch[] {
    return Array.from(this.batches.values());
  }

  // Completion methods
  saveCompletion(completion: CompletionData): void {
    this.completions.set(completion.projectId, completion);
    this.logger.debug(`Saved completion for project ${completion.projectId}`);
  }

  getCompletion(projectId: string): CompletionData | undefined {
    return this.completions.get(projectId);
  }

  getAllCompletions(): CompletionData[] {
    return Array.from(this.completions.values());
  }

  // Utility methods
  getProjectsByBatch(batchId: string): Project[] {
    return Array.from(this.projects.values()).filter(p => p.batchId === batchId);
  }

  updateBatchProjectStatus(batchId: string, projectId: string, status: string, error?: string): void {
    const batch = this.batches.get(batchId);
    if (batch) {
      const project = batch.projects.find(p => p.id === projectId);
      if (project) {
        project.status = status;
        if (error) project.error = error;
        
        // Update batch counts
        batch.completedCount = batch.projects.filter(p => p.status === 'completed').length;
        batch.failedCount = batch.projects.filter(p => p.status === 'failed').length;
        
        this.batches.set(batchId, batch);
        this.logger.debug(`Updated batch ${batchId} project ${projectId} status to ${status}`);
      }
    }
  }
}