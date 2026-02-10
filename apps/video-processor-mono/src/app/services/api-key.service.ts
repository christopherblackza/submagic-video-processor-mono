import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiKey, CreateApiKeyRequest, RotateApiKeyRequest } from '../models/api-key.model';

@Injectable({
  providedIn: 'root'
})
export class ApiKeyService {
  private apiUrl = `${environment.apiUrl}/api-keys`;

  constructor(private http: HttpClient) {}

  getApiKeys(): Observable<ApiKey[]> {
    return this.http.get<ApiKey[]>(this.apiUrl);
  }

  createApiKey(keyName: string, keyValue: string): Observable<ApiKey> {
    const payload: CreateApiKeyRequest = { keyName, keyValue };
    return this.http.post<ApiKey>(this.apiUrl, payload);
  }

  rotateApiKey(id: string, keyValue: string): Observable<ApiKey> {
    const payload: RotateApiKeyRequest = { keyValue };
    return this.http.patch<ApiKey>(`${this.apiUrl}/${id}/rotate`, payload);
  }

  deleteApiKey(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/${id}`);
  }
}
