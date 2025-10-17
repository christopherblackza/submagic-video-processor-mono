import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { Batch, BatchProject } from '../../models/project.model';
import { interval, Subscription } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';

@Component({
  selector: 'app-batch-success',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './batch-success.component.html',
  styleUrl: './batch-success.component.scss'
})
export class BatchSuccessComponent implements OnInit, OnDestroy {
  batchId: string = '';
  batch: Batch | null = null;
  loading = true;
  error = '';
  private pollingSubscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService
  ) {}

  ngOnInit() {
    this.batchId = this.route.snapshot.paramMap.get('batchId') || '';
    if (this.batchId) {
      this.loadBatchData();
      this.startPolling();
    } else {
      this.error = 'Invalid batch ID';
      this.loading = false;
    }
  }

  ngOnDestroy() {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
  }

  private loadBatchData() {
    this.projectService.getBatchDetails(this.batchId).subscribe({
      next: (batch: Batch) => {
        this.batch = batch;
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading batch data:', error);
        this.error = 'Failed to load batch information';
        this.loading = false;
      }
    });
  }

  private startPolling() {
    // Poll every 5 seconds for updates
    this.pollingSubscription = interval(5000)
      .pipe(
        switchMap(() => this.projectService.getBatchDetails(this.batchId)),
        takeWhile(() => this.hasIncompleteProjects(), true)
      )
      .subscribe({
        next: (batch: Batch) => {
          this.batch = batch;
        },
        error: (error: any) => {
          console.error('Polling error:', error);
        }
      });
  }

  hasIncompleteProjects(): boolean {
    if (!this.batch?.projects) return false;
    return this.batch.projects.some(project => 
      project.status === 'processing' || project.status === 'pending'
    );
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'completed':
        return 'status-completed';
      case 'processing':
        return 'status-processing';
      case 'failed':
        return 'status-failed';
      case 'pending':
      default:
        return 'status-pending';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'completed':
        return '✓';
      case 'processing':
        return '⟳';
      case 'failed':
        return '✗';
      case 'pending':
      default:
        return '○';
    }
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

  viewProject(project: BatchProject) {
    if (project.status === 'completed') {
      this.router.navigate(['/completion', project.id], { 
        queryParams: { from: 'batch' } 
      });
    }
  }

  refreshBatch() {
    this.loading = true;
    this.loadBatchData();
  }

  goHome() {
    this.router.navigate(['/']);
  }
}