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
}

export interface Batch {
  id: string;
  createdAt: string;
  projects: BatchProject[];
  totalCount: number;
  completedCount: number;
  failedCount: number;
  status?: string;
}

export interface BatchProject {
  id: string;
  title: string;
  status: string;
  error?: string;
  errorCode?: string;
  createdAt: string;
}

export interface CompletionData {
  projectId: string;
  id?: string;
  status: string;
  downloadUrl?: string;
  exports?: any[];
  receivedAt: string;
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