export interface ApiKey {
  id: string;
  key_name: string;
  created_at: string;
  last_used_at?: string;
}

export interface CreateApiKeyRequest {
  keyName: string;
  keyValue: string;
}

export interface RotateApiKeyRequest {
  keyValue: string;
}
