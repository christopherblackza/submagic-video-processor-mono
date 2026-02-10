import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async trackJobStart(userId: string, jobType: string, parameters: any, token?: string): Promise<string | null> {
    try {
      const allowed = await this.checkQuota(userId);
      if (!allowed) {
        this.logger.warn(`User ${userId} exceeded quota`);
        return null;
      }

      const client = token 
        ? this.supabaseService.getClientWithToken(token)
        : this.supabaseService.getServiceRoleClient();
      
      const { data, error } = await client
        .from('jobs')
        .insert({
          user_id: userId,
          job_type: jobType,
          status: 'pending',
          parameters: parameters,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        this.logger.error(`Failed to track job start: ${error.message}`);
        return null;
      }

      return data?.id;
    } catch (error) {
      this.logger.error(`Error tracking job: ${error.message}`);
      return null;
    }
  }

  async updateJobStatus(jobId: string, status: string, token?: string, errorLogs?: string): Promise<void> {
    try {
      const client = token 
        ? this.supabaseService.getClientWithToken(token)
        : this.supabaseService.getServiceRoleClient();
      
      const updateData: any = {
        status,
        // updated_at is handled by DB trigger usually, but we can set it if needed
      };

      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }
      
      if (status === 'processing') {
         updateData.started_at = new Date().toISOString();
      }

      if (errorLogs) {
        updateData.error_logs = errorLogs;
      }
      
      const { error } = await client
        .from('jobs')
        .update(updateData)
        .eq('id', jobId);

      if (error) {
        this.logger.error(`Failed to update job status: ${error.message}`);
      }
    } catch (error) {
      this.logger.error(`Error updating job: ${error.message}`);
    }
  }

  async checkQuota(userId: string): Promise<boolean> {
    // TODO: Implement actual billing/subscription check
    // For now, simple daily limit check could go here
    return true;
  }

  async getUserUsage(userId: string) {
    const { count, error } = await this.supabaseService.getServiceRoleClient()
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
      
    if (error) {
      this.logger.error(`Failed to get usage: ${error.message}`);
      throw new Error('Failed to get usage stats');
    }
    return { totalJobs: count };
  }
}
