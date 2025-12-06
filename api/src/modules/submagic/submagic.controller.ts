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
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiHeader,
} from "@nestjs/swagger";
import { SubmagicService } from "./submagic.service";
import { RedisService } from "../redis/redis.service";
import { StorageService } from "../storage/storage.service";
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

@ApiTags("Submagic")
@Controller("submagic")
export class SubmagicController {
  private readonly logger = new Logger(SubmagicController.name);

  constructor(
    private readonly submagicService: SubmagicService,
    private readonly storageService: StorageService,
    private readonly redisService: RedisService
  ) {}

  @Post("save-api-key")
  @ApiOperation({ summary: "Save Submagic API key to Redis" })
  @ApiHeader({ name: "x-api-key", description: "Submagic API key", required: true })
  async saveApiKey(@Headers("x-api-key") apiKey?: string) {
    if (!apiKey || apiKey.trim() === "") {
      throw new BadRequestException("x-api-key header is required");
    }
    await this.redisService.setApiKey(apiKey);
    return { message: "API key saved" };
  }

  @Post("start")
  @ApiOperation({ summary: "Start single video processing" })
  @ApiResponse({ status: 200, description: "Project started successfully" })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiConsumes("application/json")
  @ApiBody({ type: StartProjectDto })
  async startProject(
    @Body() dto: StartProjectDto,
    @Headers("x-api-key") apiKey?: string
  ) {
    this.logger.log("Starting single video project");

    if (!dto.videoUrl) {
      throw new BadRequestException(
        "videoUrl is required for single video processing"
      );
    }

    const result = await this.submagicService.startProject(dto, apiKey);

    // Store project in memory
    const project: Project = {
      id: result.projectId,
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

    this.storageService.saveProject(project);

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
  @ApiHeader({
    name: "x-api-key",
    description: "API key for authentication (optional, uses Redis if omitted)",
    required: false,
  })
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
    @UploadedFiles() files: { media?: Array<Express.Multer.File> },
    @Headers("x-api-key") apiKey?: string
  ) {
    const mediaFiles = files?.media || [];
    if (!mediaFiles || mediaFiles.length === 0) {
      throw new BadRequestException(
        'At least one file is required in the "media" field'
      );
    }
    return this.submagicService.uploadUserMedia(mediaFiles, apiKey);
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
    @Param("projectId") projectId: string,
    @Body() dto: UpdateProjectDto,
    @Headers("x-api-key") apiKey?: string
  ) {
    this.logger.log(`Updating project ${projectId}`);

    // Validate that the project exists in our storage
    const existingProject = this.storageService.getProject(projectId);
    if (!existingProject) {
      throw new BadRequestException(`Project ${projectId} not found`);
    }

    const result = await this.submagicService.updateProject(
      projectId,
      dto,
      apiKey
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
    @Param("projectId") projectId: string,
    @Body() dto: ExportProjectDto,
    @Headers("x-api-key") apiKey?: string
  ) {
    this.logger.log(`Exporting project ${projectId}`);

    // Validate that the project exists in our storage
    // const existingProject = this.storageService.getProject(projectId);
    // if (!existingProject) {
    //   throw new BadRequestException(`Project ${projectId} not found`);
    // }

    const result = await this.submagicService.exportProject(
      projectId,
      dto,
      apiKey
    );

    this.logger.log(`Project ${projectId} export started successfully`);
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
    @Param("projectId") projectId: string,
    @Headers("x-api-key") apiKey?: string
  ) {
    this.logger.log(`Getting project details for ${projectId}`);

    const result = await this.submagicService.getProject(projectId, apiKey);

    this.logger.log(`Project details retrieved for ${projectId}`);
    return result;
  }

  @Get("templates")
  @ApiOperation({ summary: "List available Submagic templates" })
  @ApiResponse({ status: 200, description: "Templates retrieved" })
  async getTemplates(@Headers("x-api-key") apiKey?: string) {
    this.logger.log("Getting templates");
    const result = await this.submagicService.getTemplates(apiKey);
    return result;
  }
}
