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
    path: 'setup',
    canActivate: [authGuard],
    loadComponent: () => import('./components/setup/setup.component').then(m => m.SetupComponent),
    title: 'Setup'
  },
  {
    path: 'upload',
    canActivate: [authGuard, apiKeyGuard],
    loadComponent: () => import('./components/video-upload/video-upload.component').then(m => m.VideoUploadComponent),
    title: 'Submagic Video Processor'
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
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
    redirectTo: 'login',
    pathMatch: 'full'
  }
];
