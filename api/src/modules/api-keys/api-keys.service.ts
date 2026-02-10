import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EncryptionService } from '../../common/services/encryption.service';

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly encryptionService: EncryptionService
  ) {}

  private get supabase() {
    return this.supabaseService.getServiceRoleClient();
  }

  async storeApiKey(userId: string, keyName: string, keyValue: string) {
    const encryptedKey = this.encryptionService.encrypt(keyValue);

    // Check if key with same name exists and update, or insert new
    // For now, let's just insert
    const { data, error } = await this.supabase
      .from('api_keys')
      .insert({
        user_id: userId,
        key_name: keyName,
        encrypted_key: encryptedKey,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to store API key: ${error.message}`);
    }
    
    await this.logAudit(userId, 'create_api_key', 'api_key', data.id, { key_name: keyName });

    return { ...data, encrypted_key: undefined }; // Don't return the encrypted key
  }

  async rotateApiKey(userId: string, id: string, newKeyValue: string) {
    const encryptedKey = this.encryptionService.encrypt(newKeyValue);

    const { data, error } = await this.supabase
      .from('api_keys')
      .update({
        encrypted_key: encryptedKey,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to rotate API key: ${error.message}`);
    }

    await this.logAudit(userId, 'rotate_api_key', 'api_key', id, { key_name: data.key_name });

    return { ...data, encrypted_key: undefined };
  }

  async getApiKeys(userId: string) {
    const { data, error } = await this.supabase
      .from('api_keys')
      .select('id, key_name, created_at, last_used_at')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to fetch API keys: ${error.message}`);
    }

    return data;
  }

  async getDecryptedKey(userId: string, keyName: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('api_keys')
      .select('id, encrypted_key')
      .eq('user_id', userId)
      .eq('key_name', keyName)
      .single();

    if (error || !data) {
      return null;
    }

    // Async update last_used_at and log audit
    this.updateLastUsed(userId, data.id, keyName).catch(err => this.logger.error(err));

    return this.encryptionService.decrypt(data.encrypted_key);
  }

  private async updateLastUsed(userId: string, keyId: string, keyName: string) {
     await this.supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyId);
     await this.logAudit(userId, 'access_api_key', 'api_key', keyId, { key_name: keyName });
  }

  private async logAudit(userId: string, action: string, resourceType: string, resourceId: string, details: any) {
    await this.supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details
    });
  }

  async deleteApiKey(userId: string, id: string) {
    const { error } = await this.supabase
      .from('api_keys')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete API key: ${error.message}`);
    }

    await this.logAudit(userId, 'delete_api_key', 'api_key', id, {});

    return { success: true };
  }
}
