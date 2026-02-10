import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

@Injectable()
export class UserMediaService {
  private readonly logger = new Logger(UserMediaService.name);

  constructor(
    private readonly supabaseService: SupabaseService
  ) {}

  async getUserMediaItems(userId: string, token: string): Promise<any[]> {
    const supabase = this.supabaseService.getClientWithToken(token);
    
    const { data, error } = await supabase
      .from('user_media_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to fetch user media items: ${error.message}`);
      throw new InternalServerErrorException(`Failed to fetch user media items: ${error.message}`);
    }

    return data;
  }
}
