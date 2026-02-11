export interface Project {
  id: string;
  title?: string;
  originalTitle?: string;
  language: string;
  templateName: string;
  videoUrl?: string;
  webhookUrl?: string;
  magicZooms?: boolean;
  magicBrolls?: boolean;
  magicBrollsPercentage?: number;
  dictionary?: string[];
  status?: string;
  createdAt?: string;
  completedAt?: string;
  batchId?: string;
  userId?: string;
  error?: string;
  uploadStatus?: 'pending' | 'completed' | 'failed';
  mediaMatchingStatus?: 'pending' | 'in_progress' | 'completed' | 'completed_no_matches' | 'failed';
  previewUrl?: string;
}

export interface Batch {
  id: string;
  userId: string;
  createdAt: string;
  projects: BatchProject[];
  totalCount: number;
  completedCount: number;
  failedCount: number;
  status?: string;
  language?: string;
  templateName?: string;
  magicZooms?: boolean;
  magicBrolls?: boolean;
  magicBrollsPercentage?: number;
}

export interface BatchProject {
  id: string;
  title: string;
  status: string;
  error?: string;
  errorCode?: string;
  createdAt: string;
  downloadUrl?: string;
  duration?: number;
  uploadStatus?: 'pending' | 'completed' | 'failed';
  mediaMatchingStatus?: 'pending' | 'in_progress' | 'completed' | 'completed_no_matches' | 'failed';
}

export interface CompletionData {
  projectId: string;
  id?: string;
  status: string;
  downloadUrl?: string;
  exports?: any[];
  receivedAt: string;
  thumbnailUrl?: string;
  duration?: number;
  fileSize?: number;
}

export interface StartProjectRequest {
  title?: string;
  language: string;
  templateName: string;
  videoUrl?: string;
  webhookUrl?: string;
  magicZooms?: boolean;
  magicBrolls?: boolean;
  magicBrollsPercentage?: number;
  dictionary?: string | string[];
}

export interface BatchStartRequest extends StartProjectRequest {
  'videoUrl[]'?: string[];
  'title[]'?: string[];
  'file[]'?: Express.Multer.File[];
}

export interface WebhookPayload {
  projectId?: string;
  id?: string;
  status?: string;
  downloadUrl?: string;
  exports?: any[];
}