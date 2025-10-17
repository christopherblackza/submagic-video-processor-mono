import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { CompletionData } from '../../models/project.model';

@Component({
  selector: 'app-completion',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './completion.component.html',
  styleUrl: './completion.component.scss'
})
export class CompletionComponent implements OnInit {
  projectId: string = '';
  completionData: CompletionData | null = null;
  loading = true;
  error = '';
  fromBatch = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService
  ) {}

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('projectId') || '';
    this.fromBatch = this.route.snapshot.queryParamMap.get('from') === 'batch';
    
    if (this.projectId) {
      this.loadCompletionData();
    } else {
      this.error = 'Invalid project ID';
      this.loading = false;
    }
  }

  private loadCompletionData() {
    this.projectService.getCompletionDetails(this.projectId).subscribe({
      next: (data: CompletionData) => {
        this.completionData = data;
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading completion data:', error);
        
        if (error.status === 404) {
          this.error = 'Project not found or still processing';
        } else {
          this.error = 'Failed to load project details';
        }
        
        this.loading = false;
      }
    });
  }

  goBack() {
    if (this.fromBatch && this.completionData?.batchId) {
      this.router.navigate(['/batch-success', this.completionData.batchId]);
    } else {
      this.router.navigate(['/']);
    }
  }

  goHome() {
    this.router.navigate(['/']);
  }

  downloadVideo() {
    if (this.completionData?.downloadUrl) {
      window.open(this.completionData.downloadUrl, '_blank');
    }
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here
      console.log('Copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
    });
  }

  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  refreshData() {
    this.loading = true;
    this.error = '';
    this.loadCompletionData();
  }
}