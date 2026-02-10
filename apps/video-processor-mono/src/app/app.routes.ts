import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { apiKeyGuard } from './guards/api-key.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent),
    title: 'Login'
  },
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () => import('./components/acount/account.component').then(m => m.AccountComponent),
    title: 'Account'
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent),
    title: 'Submagic Video Processor'
  },
  {
    path: 'system-prompt',
    canActivate: [authGuard],
    loadComponent: () => import('./components/system-prompt/system-prompt.component').then(m => m.SystemPromptComponent),
    title: 'System Prompt'
  },
  {
    path: 'media-upload',
     canActivate: [authGuard],
    loadComponent: () => import('./components/media-upload/media-upload.component').then(m => m.MediaUploadComponent),
    title: 'Upload Media'
  },
  {
    path: 'batch-success/:batchId',
     canActivate: [authGuard],
    loadComponent: () => import('./components/batch-success/batch-success.component').then(m => m.BatchSuccessComponent),
    title: 'Batch Processing Status'
  },
  {
    path: 'completion/:projectId',
     canActivate: [authGuard],
    loadComponent: () => import('./components/completion/completion.component').then(m => m.CompletionComponent),
    title: 'Project Results'
  },
  {
    path: '**',
    redirectTo: 'login',
    pathMatch: 'full'
  }
];
