export type ProjectStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'error';

export interface Project {
  id: string;
  title: string;
  originalTitle?: string;
  status: ProjectStatus;
  language: string;
  templateName: string;
  videoUrl?: string;
  webhookUrl?: string;
  magicZooms?: boolean;
  magicBrolls?: boolean;
  magicBrollsPercentage?: number;
  dictionary?: string;
  batchId?: string;
  createdAt: string;
  completedAt?: string;
  duration?: string;
  downloadUrl?: string;
  previewUrl?: string;
  error?: string;
}

export interface BatchProject {
  id: string;
  title: string;
  status: ProjectStatus;
  createdAt: string;
  error?: string;
}

export interface Batch {
  id: string;
  createdAt: string;
  projects: BatchProject[];
  templateName: string;
  totalCount: number;
  completedCount: number;
  failedCount: number;
  language?: string;
  status?: string;
  magicBrolls?: boolean;
  magicBrollsPercentage?: number;
  magicZooms?: boolean;
  
}

export interface CompletionData {
  project: Project;
  downloadUrl?: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  fileSize?: number;
  batchId?: string;
  stillProcessing?: boolean;
}

export interface VideoInput {
  title: string;
  videoUrl?: string;
  file?: File;
}

export interface BatchStartRequest {
  videos: VideoInput[];
  language?: string;
  templateName?: string;
  webhookUrl?: string;
  magicZooms?: boolean;
  magicBrolls?: boolean;
  magicBrollsPercentage?: number;
  dictionary?: string;
}

export interface BatchStartResponse {
  ok: boolean;
  batchId: string;
  projectIds: string[];
  totalProjects: number;
  successfulProjects: number;
  failedProjects: number;
}

export interface SingleProjectRequest {
  title?: string;
  language?: string;
  templateName?: string;
  videoUrl?: string;
  file?: File;
  webhookUrl?: string;
  magicZooms?: boolean;
  magicBrolls?: boolean;
  magicBrollsPercentage?: number;
  dictionary?: string;
}

export interface SingleProjectResponse {
  ok: boolean;
  project: Project;
  webhookUrl: string;
}