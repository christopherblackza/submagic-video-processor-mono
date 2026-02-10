import {
  Controller,
  Get,
  UseGuards,
  Request,
  Logger,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { UserMediaService } from "./user-media.service";
import { SupabaseAuthGuard } from "../../common/guards/supabase-auth.guard";

@ApiTags("User Media")
@ApiBearerAuth()
@Controller("user-media")
@UseGuards(SupabaseAuthGuard)
export class UserMediaController {
  private readonly logger = new Logger(UserMediaController.name);

  constructor(
    private readonly userMediaService: UserMediaService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get user media items" })
  @ApiResponse({ status: 200, description: "List of user media items" })
  async getUserMedia(@Request() req) {
    const userId = req.user.id;
    const token = req.token;
    return this.userMediaService.getUserMediaItems(userId, token);
  }
}
