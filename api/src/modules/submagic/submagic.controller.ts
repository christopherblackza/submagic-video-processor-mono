import {
  Controller,
  Post,
  Patch,
  Get,
  Param,
  Body,
  Headers,
  BadRequestException,
  Logger,
  UploadedFile,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiHeader,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { SubmagicService } from "./submagic.service";
import {
  StartProjectDto,
  UpdateProjectDto,
  ExportProjectDto,
} from "../../common/dto/start-project.dto";
import { Project } from "../../common/interfaces/project.interface";
import {
  FilesInterceptor,
  FileFieldsInterceptor,
} from "@nestjs/platform-express";
import { SupabaseAuthGuard } from "../../common/guards/supabase-auth.guard";
import { ProjectService } from "../project/project.service";

@ApiTags("Submagic")
@ApiBearerAuth()
@Controller("submagic")
@UseGuards(SupabaseAuthGuard)
export class SubmagicController {
  private readonly logger = new Logger(SubmagicController.name);

  constructor(
    private readonly submagicService: SubmagicService,
    private readonly projectService: ProjectService,
  ) {}

  @Post("start")
  @ApiOperation({ summary: "Start single video processing" })
  @ApiResponse({ status: 200, description: "Project started successfully" })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiConsumes("application/json")
  @ApiBody({ type: StartProjectDto })
  async startProject(
    @Request() req,
    @Body() dto: StartProjectDto,
  ) {
    this.logger.log("Starting single video project");
    const userId = req.user.id;
    const token = req.token;

    if (!dto.videoUrl) {
      throw new BadRequestException(
        "videoUrl is required for single video processing"
      );
    }

    const result = await this.submagicService.startProject(dto, userId, token);

    // Store project in memory
    const project: Project = {
      id: result.projectId,
      userId: userId,
      title: dto.title,
      originalTitle: dto.title,
      language: dto.language,
      templateName: dto.templateName,
      videoUrl: dto.videoUrl,
      webhookUrl: dto.webhookUrl,
      magicZooms: dto.magicZooms,
      magicBrolls: dto.magicBrolls,
      magicBrollsPercentage: dto.magicBrollsPercentage,
      dictionary: Array.isArray(dto.dictionary) ? dto.dictionary : undefined,
      status: "processing",
      createdAt: new Date().toISOString(),
    };

    this.projectService.saveProject(project);

    this.logger.log(`Project ${result.projectId} started and stored`);
    return result;
  }

  @Post("start-with-file")
  @ApiOperation({
    summary:
      "Start single video processing (deprecated - use /start with videoUrl instead)",
  })
  @ApiResponse({ status: 400, description: "File uploads no longer supported" })
  async startProjectWithFile() {
    throw new BadRequestException(
      "File uploads are no longer supported. Please use the /start endpoint with a videoUrl instead."
    );
  }

  @Post("upload-user-media")
  @UseInterceptors(FileFieldsInterceptor([{ name: "media", maxCount: 400 }]))
  @ApiOperation({
    summary:
      "Upload multiple user media files to Submagic and persist references",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        media: {
          type: "array",
          items: { type: "string", format: "binary" },
        },
      },
      required: ["media"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "User media uploaded and references saved",
  })
  async uploadUserMedia(
    @Request() req,
    @UploadedFiles() files: { media?: Array<Express.Multer.File> }
  ) {
    const userId = req.user.id;
    const mediaFiles = files?.media || [];
    if (!mediaFiles || mediaFiles.length === 0) {
      throw new BadRequestException(
        'At least one file is required in the "media" field'
      );
    }
    return this.submagicService.uploadUserMedia(mediaFiles, userId);
  }

  @Patch("update/:projectId")
  @ApiOperation({
    summary: "Update an existing project with new settings or B-roll items",
  })
  @ApiParam({
    name: "projectId",
    description: "The unique identifier (UUID) of the project to update",
  })
  @ApiResponse({ status: 200, description: "Project updated successfully" })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 404, description: "Project not found" })
  @ApiConsumes("application/json")
  @ApiBody({ type: UpdateProjectDto })
  async updateProject(
    @Request() req,
    @Param("projectId") projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    const userId = req.user.id;
    this.logger.log(`Updating project ${projectId}`);

    // Validate that the project exists in our storage
    const existingProject = this.projectService.getProject(projectId);
    if (!existingProject) {
      throw new BadRequestException(`Project ${projectId} not found`);
    }

    const result = await this.submagicService.updateProject(
      projectId,
      dto,
      userId
    );

    this.logger.log(`Project ${projectId} updated successfully`);
    return result;
  }

  @Post("export/:projectId")
  @ApiOperation({ summary: "Export a Submagic project" })
  @ApiParam({
    name: "projectId",
    description: "The unique identifier (UUID) of the project to export",
  })
  @ApiResponse({
    status: 200,
    description: "Project export started successfully",
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 404, description: "Project not found" })
  @ApiConsumes("application/json")
  // @ApiBody({ type: ExportProjectDto })
  async exportProject(
    @Request() req,
    @Param("projectId") projectId: string,
    @Body() dto: ExportProjectDto,
  ) {
    const userId = req.user.id;
    const token = req.token;
    
    this.logger.log(`Exporting project ${projectId}`);

    // Validate that the project exists in our storage
    const existingProject = this.projectService.getProject(projectId);
    if (!existingProject) {
      throw new BadRequestException(`Project ${projectId} not found`);
    }

    const result = await this.submagicService.exportProject(
      projectId,
      dto,
      userId,
      token
    );

    this.logger.log(`Project ${projectId} export started`);
    return result;
  }

  @Get("project/:projectId")
  @ApiOperation({ summary: "Get project details from Submagic API" })
  @ApiParam({
    name: "projectId",
    description: "The unique identifier (UUID) of the project to retrieve",
  })
  @ApiResponse({
    status: 200,
    description: "Project details retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "Project not found" })
  @ApiResponse({ status: 401, description: "Unauthorized - Invalid API key" })
  async getProject(
    @Request() req,
    @Param("projectId") projectId: string
  ) {
    const userId = req.user.sub;
    this.logger.log(`Getting project details for ${projectId}`);

    const result = await this.submagicService.getProject(projectId, userId);

    this.logger.log(`Project details retrieved for ${projectId}`);
    return result;
  }

  @Get("templates")
  @ApiOperation({ summary: "List available Submagic templates" })
  @ApiResponse({ status: 200, description: "Templates retrieved" })
  async getTemplates(@Request() req) {
    const userId = req.user.sub;
    this.logger.log("Getting templates");
    const result = await this.submagicService.getTemplates(userId);
    return result;
  }
}
