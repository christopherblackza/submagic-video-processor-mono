import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabaseUrl: string;
  private supabaseKey: string;
  private serviceRoleKey: string;
  private clientInstance: SupabaseClient | null = null;
  private serviceRoleClientInstance: SupabaseClient | null = null;

  constructor(private configService: ConfigService) {
    this.supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    this.supabaseKey = this.configService.get<string>('SUPABASE_KEY');
    this.serviceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_KEY must be configured');
    }

    if (!this.serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY must be configured');
    }
    
  }

  getClient(): SupabaseClient {
     if (!this.clientInstance) {
       this.clientInstance = createClient(this.supabaseUrl, this.supabaseKey);
     }
     return this.clientInstance;
  }

  getServiceRoleClient(): SupabaseClient {
    if (!this.serviceRoleClientInstance) {
      if (!this.serviceRoleKey) {
        // Fallback to anon key if service role key is not configured (will likely fail RLS)
        this.serviceRoleClientInstance = this.getClient();
      } else {
        this.serviceRoleClientInstance = createClient(this.supabaseUrl, this.serviceRoleKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
          realtime: {
            timeout: 30000,
          },
        });
      }
    }
    return this.serviceRoleClientInstance;
  }

  getClientWithToken(token: string): SupabaseClient {
    return createClient(this.supabaseUrl, this.supabaseKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });
  }
}
