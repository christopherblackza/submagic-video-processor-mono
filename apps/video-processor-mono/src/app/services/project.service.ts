import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { 
  Project, 
  Batch, 
  CompletionData, 
  BatchStartRequest, 
  BatchStartResponse,
  SingleProjectRequest,
  SingleProjectResponse
} from '../models/project.model';
 
export interface TemplatesResponse { templates: string[] }

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private buildHeaders(json: boolean = true): HttpHeaders {
    let headers = new HttpHeaders(json ? { 'Content-Type': 'application/json' } : {});
    const key = localStorage.getItem('submagic_api_key');
    if (key) {
      headers = headers.set('x-api-key', key);
    }
    return headers;
  }

  getTemplates(): Observable<TemplatesResponse> {
    const headers = this.buildHeaders(false);
    return this.http.get<TemplatesResponse>(`${this.apiUrl}/submagic/templates`, { headers });
  }

  /**
   * Start processing a single video
   */
  startSingleProject(request: SingleProjectRequest): Observable<SingleProjectResponse> {
    const formData = new FormData();
    
    if (request.title) formData.append('title', request.title);
    if (request.language) formData.append('language', request.language);
    if (request.templateName) formData.append('templateName', request.templateName);
    if (request.videoUrl) formData.append('videoUrl', request.videoUrl);
    if (request.webhookUrl) formData.append('webhookUrl', request.webhookUrl);
    if (request.magicZooms !== undefined) formData.append('magicZooms', request.magicZooms.toString());
    if (request.magicBrolls !== undefined) formData.append('magicBrolls', request.magicBrolls.toString());
    if (request.magicBrollsPercentage !== undefined) formData.append('magicBrollsPercentage', request.magicBrollsPercentage.toString());
    if (request.dictionary) formData.append('dictionary', request.dictionary);
    if (request.file) formData.append('file', request.file);

    return this.http.post<SingleProjectResponse>(`${this.apiUrl}/submagic/start`, formData);
  }

  /**
   * Start batch processing of multiple videos
   */
  startBatchProcessing(request: BatchStartRequest): Observable<BatchStartResponse> {
    // Send JSON payload instead of FormData for URL-based videos
    const jsonPayload = {
      videos: request.videos.map(video => ({
        title: video.title,
        videoUrl: video.videoUrl
      })),
      language: request.language,
      templateName: request.templateName,
      webhookUrl: request.webhookUrl,
      magicZooms: request.magicZooms,
      magicBrolls: request.magicBrolls,
      magicBrollsPercentage: request.magicBrollsPercentage,
      dictionary: request.dictionary
    };

    const headers = this.buildHeaders(true);

    return this.http.post<BatchStartResponse>(`${this.apiUrl}/batch-start`, jsonPayload, { headers });
  }

  /**
   * Get project details by ID
   */
  getProject(projectId: string): Observable<Project> {
    const headers = this.buildHeaders(false);
    return this.http.get<Project>(`${this.apiUrl}/project/${projectId}`, { headers });
  }

  /**
   * Get batch details by ID
   */
  getBatch(batchId: string): Observable<Batch> {
    const headers = this.buildHeaders(false);
    return this.http.get<Batch>(`${this.apiUrl}/batch-success/${batchId}`, { headers });
  }

  // Get batch details
  getBatchDetails(batchId: string): Observable<Batch> {
    const headers = this.buildHeaders(false);
    return this.http.get<Batch>(`${this.apiUrl}/batch-success/${batchId}`, { headers });
  }

  /**
   * Get completion data for a project
   */
  getCompletion(projectId: string): Observable<CompletionData> {
    const headers = this.buildHeaders(false);
    return this.http.get<CompletionData>(`${this.apiUrl}/completion/${projectId}`, { headers });
  }

  // Get completion details
  getCompletionDetails(projectId: string): Observable<CompletionData> {
    const headers = this.buildHeaders(false);
    return this.http.get<CompletionData>(`${this.apiUrl}/completion/${projectId}`, { headers });
  }

  /**
   * Check health status of the API
   */
  checkHealth(): Observable<{ ok: boolean }> {
    const headers = this.buildHeaders(false);
    return this.http.get<{ ok: boolean }>(`${this.apiUrl}/health`, { headers });
  }

  // Health check
  checkHealthStatus(): Observable<{ status: string }> {
    const headers = this.buildHeaders(false);
    return this.http.get<{ status: string }>(`${this.apiUrl}/health`, { headers });
  }

  /**
   * Upload multiple media files.
   */
  uploadMediaFiles(files: File[]): Observable<any> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('media', file, file.name);
    });

    return this.http.post(`${this.apiUrl}/submagic/upload-user-media`, formData);
  }
}
