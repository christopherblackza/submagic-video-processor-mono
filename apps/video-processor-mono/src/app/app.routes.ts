import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

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
    title: 'Clip Relay'
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
    path: 'media-library',
    canActivate: [authGuard],
    loadComponent: () => import('./components/media-library/media-library.component').then(m => m.MediaLibraryComponent),
    title: 'Media Library'
  },
  {
    path: 'batch/:batchId',
     canActivate: [authGuard],
    loadComponent: () => import('./components/batch/batch.component').then(m => m.BatchComponent),
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
