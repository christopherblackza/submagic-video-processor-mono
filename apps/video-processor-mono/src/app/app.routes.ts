import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/video-upload/video-upload.component').then(m => m.VideoUploadComponent),
    title: 'Submagic Video Processor'
  },
  {
    path: 'batch-success/:batchId',
    loadComponent: () => import('./components/batch-success/batch-success.component').then(m => m.BatchSuccessComponent),
    title: 'Batch Processing Status'
  },
  {
    path: 'completion/:projectId',
    loadComponent: () => import('./components/completion/completion.component').then(m => m.CompletionComponent),
    title: 'Project Results'
  },
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full'
  }
];
