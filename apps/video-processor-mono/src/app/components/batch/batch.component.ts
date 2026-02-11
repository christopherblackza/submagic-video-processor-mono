import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { AuthService } from '../../services/auth.service';
import { AnalyticsService } from '../../services/analytics.service';
import { Batch, BatchProject, BatchStatusResponse } from '../../models/project.model';
import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-batch',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './batch.component.html',
  styleUrl: './batch.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BatchComponent implements OnInit, OnDestroy {
  batchId: string = '';
  batch: Batch | null = null;
  loading = true;
  error = '';
  successMessage = '';
  
  private supabase: SupabaseClient;
  private channel: RealtimeChannel | null = null;
  private retryCount = 0;
  private readonly MAX_RETRIES = 3;
  
  updatingProjectIds = new Set<string>();
  
  showAnalyzeModal = false;
  analyzingProject: BatchProject | null = null;
  analysisResult: any = null;
  isAnalyzing = false;
  
  // Batch Operations State
  analysisResults = new Map<string, any>();
  isBatchAnalyzing = false;
  isBatchUpdating = false;

  // Toast Notification
  toastMessage: string | null = null;
  toastType: 'success' | 'error' = 'success';
  private toastTimeout: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private authService: AuthService,
    private analytics: AnalyticsService,
    private cdr: ChangeDetectorRef
  ) {
    this.supabase = this.authService.client;
  }

  showToast(message: string, type: 'success' | 'error' = 'success') {
    this.toastMessage = message;
    this.toastType = type;
    this.cdr.markForCheck();
    
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    
    this.toastTimeout = setTimeout(() => {
      this.toastMessage = null;
      this.cdr.markForCheck();
    }, 5000);
  }

  ngOnInit() {
    this.batchId = this.route.snapshot.paramMap.get('batchId') || '';
    if (this.batchId) {
      this.analytics.trackPageView('Batch Success');
      this.loadBatchData();
      this.setupRealtimeSubscription();
    } else {
      this.error = 'Invalid batch ID';
      this.loading = false;
      this.analytics.logError('Batch Error', { message: 'Invalid batch ID' });
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy() {
    this.cleanupSubscription();
  }

  private cleanupSubscription() {
    if (this.channel) {
      this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  private loadBatchData() {
    this.projectService.getBatch(this.batchId).subscribe({
      next: (response: BatchStatusResponse) => {
        console.log("RESPONSE:", response);
        this.batch = response.batch;
        
        // Show content as soon as we have batch data
        this.loading = false;
        
        // Continue polling if still processing
        if (this.batch.status === 'pending' || this.batch.status === 'processing') {
          setTimeout(() => this.loadBatchData(), 3000);
        }

        this.cdr.markForCheck();
      },
      error: (error: any) => {
        console.error('Error loading batch data:', error);
        
        // Retry on error (e.g. 404 if created but not yet available, or network issue)
        if (this.retryCount < this.MAX_RETRIES) {
          this.retryCount++;
          console.log(`Retrying batch load (${this.retryCount}/${this.MAX_RETRIES})...`);
          setTimeout(() => this.loadBatchData(), 3000);
        } else {
          this.error = 'Failed to load batch information';
          this.loading = false;
          this.analytics.logError('Batch Load Error', error);
        }
        
        this.cdr.markForCheck();
      }
    });
  }

  private setupRealtimeSubscription() {
    const user = this.authService.currentUser;
    if (!user) {
      console.warn('No authenticated user, skipping realtime subscription');
      return;
    }

    this.cleanupSubscription();

    const channelName = `batch_updates_${this.batchId}_${Date.now()}`;
    this.channel = this.supabase.channel(channelName);

    console.log('BATCH ID SUB:', this.batchId);

    this.channel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `batch_id=eq.${this.batchId}`,
        },
        (payload) => {
          console.log('Received project update:', payload);
          this.handleProjectUpdate(payload.new);
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Connected to realtime updates');
          this.error = '';
          this.retryCount = 0;
          this.cdr.markForCheck();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Realtime connection error:', status, err);
          this.handleConnectionError();
        }
      });
  }

  private handleConnectionError() {
    if (this.retryCount < this.MAX_RETRIES) {
      this.retryCount++;
      this.error = `Connection lost. Reconnecting (Attempt ${this.retryCount}/${this.MAX_RETRIES})...`;
      this.cdr.markForCheck();
      setTimeout(() => {
        if (this.channel) {
          console.log('Attempting to reconnect...');
          this.setupRealtimeSubscription();
        }
      }, 5000 * this.retryCount);
    } else {
      this.error = 'Connection lost. Please refresh the page.';
      this.analytics.logError('Realtime Connection Failed', { batchId: this.batchId });
      this.cdr.markForCheck();
    }
  }

  private handleProjectUpdate(project: any) {
    if (!this.batch || !this.batch.projects) return;

    const batchId = project.metadata?.batchId;
    if (batchId && batchId !== this.batchId) return;

    const localProject = this.batch.projects.find(p => p.id === project.id);
    
    if (localProject) {
      const oldStatus = localProject.status;
      const newStatus = project.status;
      const metadata = project.metadata || {};

      // Update status and core fields
      localProject.status = newStatus;
      
      // Trigger media matching if project just completed
      if (oldStatus !== 'completed' && newStatus === 'completed') {
        if (!metadata.mediaMatchingStatus || metadata.mediaMatchingStatus === 'pending') {
          console.log(`Project ${project.id} completed. Triggering media matching...`);
          
          // Optimistically update status to show loading state
          localProject.mediaMatchingStatus = 'in_progress';
          this.cdr.markForCheck();

          this.projectService.analyzeAndUpdateProject(project.id).subscribe({
            next: (response) => {
              console.log(`Media matching initiated/completed for ${project.id}`, response);
              // The realtime update will eventually come back with 'completed' status
            },
            error: (err) => {
              console.error(`Failed to trigger media matching for ${project.id}`, err);
              localProject.mediaMatchingStatus = 'failed';
              this.cdr.markForCheck();
            }
          });
        }
      }

      if (metadata.error) localProject.error = metadata.error;
      if (metadata.uploadStatus) localProject.uploadStatus = metadata.uploadStatus;
      if (metadata.mediaMatchingStatus) localProject.mediaMatchingStatus = metadata.mediaMatchingStatus;

      // Update result data if completed
      if (project.status === 'completed' && metadata.result) {
        const result = metadata.result;
        localProject.downloadUrl = result.downloadUrl || result.videoUrl;
        localProject.previewUrl = result.previewUrl || result.viewUrl; 
        localProject.directUrl = result.directUrl;
        localProject.duration = result.duration;
        
        if (result.title) localProject.title = result.title;
        
        this.analytics.logEvent('Project Completed', { projectId: project.id });
      } else if (project.status === 'failed') {
        this.analytics.logEvent('Project Failed', { projectId: project.id, error: metadata.error });
      }

      this.cdr.markForCheck();
    }
  }

  hasIncompleteProjects(): boolean {
    if (!this.batch?.projects) return false;
    return this.batch.projects.some(project => 
      project.status === 'processing' || project.status === 'pending'
    );
  }

  getStatusClass(project: BatchProject): string {
    if (project.status === 'completed') return 'status-completed';
    if (project.status === 'failed' || project.status === 'error') return 'status-failed';
    if (project.mediaMatchingStatus === 'in_progress') return 'status-matching';
    if (project.status === 'processing') return 'status-processing';
    return 'status-pending';
  }

  getStatusLabel(project: BatchProject): string {
    if (project.mediaMatchingStatus === 'in_progress') return 'Matching Media...';
    if (project.status === 'completed') return 'Completed';
    if (project.status === 'failed' || project.status === 'error') return 'Failed';
    if (project.uploadStatus === 'pending') return 'Uploading...';
    if (project.status === 'processing') return 'Processing...';
    return 'Pending';
  }

  getStatusIcon(project: BatchProject): string {
    if (project.status === 'completed') return '✓';
    if (project.status === 'failed' || project.status === 'error') return '✗';
    if (project.mediaMatchingStatus === 'in_progress' || project.status === 'processing') return '⟳';
    return '○';
  }

  getProgressPercentage(): number {
    if (!this.batch?.projects || this.batch.projects.length === 0) return 0;
    const completedCount = this.batch.projects.filter(p => p.status === 'completed').length;
    return Math.round((completedCount / this.batch.projects.length) * 100);
  }

  getCompletedCount(): number {
    if (!this.batch?.projects) return 0;
    return this.batch.projects.filter(p => p.status === 'completed').length;
  }

  getTotalCount(): number {
    return this.batch?.projects?.length || 0;
  }

  trackByProjectId(index: number, project: BatchProject): string {
    return project.id;
  }

  formatDuration(seconds: number): string {
    if (!seconds && seconds !== 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  formatTime(seconds: number): string {
    return this.formatDuration(seconds);
  }

  getProjectIndex(project: BatchProject): number {
    if (!this.batch || !this.batch.projects) return 0;
    return this.batch.projects.findIndex(p => p.id === project.id) + 1;
  }

  analyzeAll() {
    if (!this.batch?.projects) return;
    const completedProjects = this.batch.projects.filter(p => p.status === 'completed');
    if (completedProjects.length === 0) return;

    this.isBatchAnalyzing = true;
    this.cdr.markForCheck();

    const observables = completedProjects.map(p => 
      this.projectService.analyzeMediaMatching(p.id).pipe(
        catchError(err => {
          console.error(`Analysis failed for ${p.id}`, err);
          return of({ error: true, projectId: p.id, message: err.message });
        })
      )
    );
    
    forkJoin(observables).subscribe({
      next: (results) => {
        results.forEach((res: any) => {
          if (res && !res.error && res.projectId) {
            this.analysisResults.set(res.projectId, res);
          }
        });
        this.isBatchAnalyzing = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Batch analysis failed', err);
        this.isBatchAnalyzing = false;
        this.cdr.markForCheck();
      }
    });
  }

  updateAll() {
    const projectsToUpdate: {projectId: string, matches: any[]}[] = [];
    console.log("analysisResults", this.analysisResults);
    this.analysisResults.forEach((result, projectId) => {
        const project = this.batch?.projects?.find(p => p.id === projectId);
        if (project && project.status === 'completed' && result.matches) {
            projectsToUpdate.push({ projectId, matches: result.matches });
        }
    });

    if (projectsToUpdate.length === 0) return;

    this.isBatchUpdating = true;
    this.cdr.markForCheck();

    const observables = projectsToUpdate.map(item => 
        this.projectService.applyMatches(item.projectId, item.matches).pipe(
            catchError(err => {
                console.error(`Update failed for ${item.projectId}`, err);
                return of({ error: true, projectId: item.projectId, message: err.message });
            })
        )
    );

    forkJoin(observables).subscribe({
        next: (results) => {
            const successCount = results.filter((r: any) => !r.error).length;
            this.successMessage = `Batch update completed. Processed ${successCount} projects.`;
            this.isBatchUpdating = false;
            this.cdr.markForCheck();
            setTimeout(() => {
                this.successMessage = '';
                this.cdr.markForCheck();
            }, 5000);
        },
        error: (err) => {
             console.error('Batch update failed', err);
             this.isBatchUpdating = false;
             this.cdr.markForCheck();
        }
    });
  }

  analyzeProject(project: BatchProject) {
    this.analyzingProject = project;
    this.showAnalyzeModal = true;
    
    if (this.analysisResults.has(project.id)) {
        this.analysisResult = this.analysisResults.get(project.id);
        console.log('Analysis result:', this.analysisResult);
        this.isAnalyzing = false;
        this.cdr.markForCheck();
    } else {
        this.analysisResult = null;
        this.isAnalyzing = true;
        this.cdr.markForCheck();

        this.projectService.analyzeMediaMatching(project.id).subscribe({
        next: (result) => {
            this.analysisResult = result;
            this.analysisResults.set(project.id, result);
            this.isAnalyzing = false;
            this.cdr.markForCheck();
        },
        error: (error) => {
            console.error('Error analyzing project:', error);
            this.isAnalyzing = false;
            
            if (error.status === 402 || error.error?.errorCode === 'INSUFFICIENT_CREDITS') {
                this.analysisResult = { error: 'Insufficient credits.' };
                this.showToast('Insufficient credits. Please upgrade your plan.', 'error');
            } else {
                this.analysisResult = { error: 'Failed to analyze project.' };
                this.showToast('Failed to analyze project. Please try again.', 'error');
            }
            
            this.cdr.markForCheck();
        }
        });
    }
  }

  applyMatchesToProject() {
      if (!this.analyzingProject || !this.analysisResult || !this.analysisResult.matches) return;
      
      const projectId = this.analyzingProject.id;
      this.isAnalyzing = true; 
      this.cdr.markForCheck();

      this.projectService.applyMatches(projectId, this.analysisResult.matches).subscribe({
          next: (res) => {
              this.successMessage = `Matches applied successfully`;
              this.closeAnalyzeModal();
              this.isAnalyzing = false;
              this.updatingProjectIds.add(projectId);
              setTimeout(() => {
                 this.updatingProjectIds.delete(projectId);
                 this.cdr.markForCheck();
              }, 2000);
              this.cdr.markForCheck();
          },
          error: (err) => {
              console.error('Failed to apply matches', err);
              this.isAnalyzing = false;
              this.cdr.markForCheck();
              
              if (err.status === 402 || err.error?.errorCode === 'INSUFFICIENT_CREDITS') {
                  this.showToast('Insufficient credits. Please upgrade your plan.', 'error');
              } else {
                  this.showToast(`Failed to apply matches: ${err.message || 'Unknown error'}`, 'error');
              }
          }
      });
  }

  closeAnalyzeModal() {
    this.showAnalyzeModal = false;
    this.analyzingProject = null;
    this.analysisResult = null;
    this.cdr.markForCheck();
  }

  viewProject(project: BatchProject) {
    console.error('PROJECT', project);
    this.analytics.logEvent('View Project', { projectId: project.id });
    if (project.previewUrl) {
      window.open(project.previewUrl, '_blank');
    } else if (project.status === 'completed') {
      this.router.navigate(['/completion', project.id], { 
        queryParams: { from: 'batch' } 
      });
    }
  }
  
  downloadProject(project: BatchProject, event: Event) {
    event.stopPropagation();
    this.analytics.logEvent('Download Project', { projectId: project.id });
    if (project.downloadUrl) {
      const link = document.createElement('a');
      link.href = project.downloadUrl;
      link.download = project.title || 'video.mp4';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  updateProject(project: BatchProject) {
    if (this.updatingProjectIds.has(project.id)) return;

    this.updatingProjectIds.add(project.id);
    this.analytics.logEvent('Update Project', { projectId: project.id });
    this.cdr.markForCheck();

    this.projectService.analyzeAndUpdateProject(project.id).subscribe({
      next: (response: any) => {
        console.log(`Update initiated for ${project.id}`, response);
        // The realtime subscription will handle the status update
        this.updatingProjectIds.delete(project.id);
        
        // Show success message with matches applied
        if (response && typeof response.matchesApplied !== 'undefined') {
          this.successMessage = `Project updated successfully! Matches applied: ${response.matchesApplied}`;
          // Auto-dismiss after 5 seconds
          setTimeout(() => {
            this.successMessage = '';
            this.cdr.markForCheck();
          }, 5000);
        }
        
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error(`Failed to update project ${project.id}`, err);
        this.updatingProjectIds.delete(project.id);
        this.cdr.markForCheck();
        
        if (err.status === 402 || err.error?.errorCode === 'INSUFFICIENT_CREDITS') {
            this.showToast('Insufficient credits. Please upgrade your plan.', 'error');
        } else {
            this.showToast(`Failed to update project: ${err.message || 'Unknown error'}`, 'error');
        }
      }
    });
  }

  refreshBatch() {
    this.loading = true;
    this.analytics.logEvent('Refresh Batch');
    this.loadBatchData();
    this.setupRealtimeSubscription();
  }

  goHome() {
    this.router.navigate(['/dashboard']);
  }
}
