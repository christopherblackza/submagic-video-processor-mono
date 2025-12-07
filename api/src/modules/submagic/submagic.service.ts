import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { AxiosResponse, AxiosError } from "axios";
import { Project } from "../../common/interfaces/project.interface";
import {
  StartProjectDto,
  UpdateProjectDto,
  ExportProjectDto,
} from "../../common/dto/start-project.dto";
import {
  normalizeDictionary,
  toBool,
  toInt,
  sanitizeHeaders,
  isLocalUrl,
} from "../../common/utils/helpers";
import {
  SubmagicApiException,
  InsufficientCreditsException,
  InvalidRequestException,
  UnauthorizedException,
  RateLimitExceededException,
  SubmagicServerException,
} from "../../common/exceptions/submagic-api.exceptions";
import FormDataLib from "form-data";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import { RedisService } from "../redis/redis.service";

@Injectable()
export class SubmagicService {
  private readonly logger = new Logger(SubmagicService.name);
  private readonly apiKey: string;
  private readonly subMagicApiUrl: string;
  private readonly publicBaseUrl: string;
  private readonly defaultLanguage: string;
  private readonly defaultTemplateName: string;
  private readonly defaultMagicZooms: boolean;
  private readonly defaultMagicBrolls: boolean;
  private readonly defaultMagicBrollsPercentage: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly redisService: RedisService
  ) {
    this.publicBaseUrl =
      this.configService.get<string>("PUBLIC_BASE_URL") || "";
    this.defaultLanguage = this.configService.get<string>(
      "DEFAULT_LANGUAGE",
      "en"
    );
    this.defaultTemplateName = this.configService.get<string>(
      "DEFAULT_TEMPLATE_NAME",
      "Hormozi 2"
    );
    this.defaultMagicZooms = this.configService.get<boolean>(
      "DEFAULT_MAGIC_ZOOMS",
      true
    );
    this.defaultMagicBrolls = this.configService.get<boolean>(
      "DEFAULT_MAGIC_BROLLS",
      false
    );
    this.defaultMagicBrollsPercentage = this.configService.get<number>(
      "DEFAULT_MAGIC_BROLLS_PERCENTAGE",
      60
    );
    this.subMagicApiUrl = this.configService.get<string>("SUBMAGIC_API_URL");

    if (!this.publicBaseUrl) {
      this.logger.error("PUBLIC_BASE_URL is required");
      throw new Error("PUBLIC_BASE_URL is required");
    }
  }

  async startProject(
    dto: StartProjectDto,
    apiKeyOverride?: string
  ): Promise<{ projectId: string }> {
    try {
      const payload = this.buildProjectPayload(dto);

      // this.logger.debug(`Payload: ${JSON.stringify(sanitizeHeaders(payload), null, 2)}`);

      const response = await this.callSubmagicAPI(payload);

      // Extract the project ID from the Submagic API response
      const projectId = response.data.id;

      if (!projectId) {
        throw new InternalServerErrorException(
          "Submagic API did not return a project ID"
        );
      }

      this.logger.log(`Project ${projectId} started successfully`);
      return { projectId };
    } catch (error) {
      this.logger.error(`Failed to start project:`, error);

      // Re-throw the error if it's already a SubmagicApiException
      if (error instanceof SubmagicApiException) {
        throw error;
      }

      // For any other errors, throw a generic internal server error
      throw new InternalServerErrorException(
        "Failed to start video processing"
      );
    }
  }

  async updateProject(
    projectId: string,
    dto: UpdateProjectDto
  ): Promise<{ message: string; id: string; status: string }> {
    try {
      const payload = this.buildUpdateProjectPayload(dto);

      this.logger.debug(
        `Update payload for project ${projectId}: ${JSON.stringify(
          payload,
          null,
          2
        )}`
      );

      const response = await this.callSubmagicUpdateAPI(projectId, payload);
      console.log("UPDATE RESPONSE: ", response);

      this.logger.log(`Project ${projectId} updated successfully`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to update project ${projectId}:`, error);

      // Re-throw the error if it's already a SubmagicApiException
      if (error instanceof SubmagicApiException) {
        throw error;
      }

      // For any other errors, throw a generic internal server error
      throw new InternalServerErrorException("Failed to update project");
    }
  }

  async exportProject(
    projectId: string,
    exportData: ExportProjectDto
  ): Promise<any> {
    try {
      this.logger.log(`Exporting project: ${projectId}`);

      const payload = this.buildExportProjectPayload(exportData);
      // this.logger.log(`Export payload: ${JSON.stringify(payload, null, 2)}`);

     
      const response = await this.callSubmagicExportAPI(
        projectId,
        payload
      );
      this.logger.log(
        `Export response: ${JSON.stringify(response.data, null, 2)}`
      );

      return response.data;
    } catch (error) {
      this.logger.error("Error exporting project:", error);
      throw new InternalServerErrorException("Failed to export project");
    }
  }

  async getProject(projectId: string): Promise<any> {
    try {
      this.logger.log(`Getting project details: ${projectId}`);

      const response = await this.callSubmagicGetAPI(projectId);
      this.logger.log(`Project details retrieved for: ${projectId}`);

      return response.data;
    } catch (error) {
      this.logger.error(`Error getting project ${projectId}:`, error);
      throw new InternalServerErrorException("Failed to get project details");
    }
  }

  async getTemplates(
    apiKeyOverride?: string
  ): Promise<{ templates: string[] }> {
    const apiKey = await this.redisService.getSubmagicApiKey();
    if (!apiKey)
      throw new UnauthorizedException("Submagic API key is required");
    const headers = {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    };
    try {
      const response = await firstValueFrom(
        this.httpService.get("https://api.submagic.co/v1/templates", {
          headers,
        })
      );
      return response.data;
    } catch (error) {
      this.handleSubmagicApiError(error);
    }
  }

  private async callSubmagicGetAPI(projectId: string): Promise<AxiosResponse> {
    const apiKey = await this.redisService.getSubmagicApiKey();
    console.log("API KEY GOT: ", apiKey);
    if (!apiKey)
      throw new UnauthorizedException("Submagic API key is required");
    const headers = {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    };

    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.subMagicApiUrl}/v1/projects/${projectId}`,
          { headers }
        )
      );
      return response;
    } catch (error) {
      this.handleSubmagicApiError(error);
    }
  }

  private buildExportProjectPayload(exportData: ExportProjectDto): any {
    const payload: any = {};

    if (exportData.fps !== undefined) {
      payload.fps = exportData.fps;
    }

    if (exportData.width !== undefined) {
      payload.width = exportData.width;
    }

    if (exportData.height !== undefined) {
      payload.height = exportData.height;
    }

    if (exportData.webhookUrl) {
      payload.webhookUrl = exportData.webhookUrl;
    }

    return payload;
  }

  private async callSubmagicExportAPI(
    projectId: string,
    payload: any
  ): Promise<any> {
    const apiKey = await this.redisService.getSubmagicApiKey();
    if (!apiKey)
      throw new UnauthorizedException("Submagic API key is required");
    const headers = {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    };

    console.log("EXPORT HEADERS: ", headers);
    console.log("EXPORT JSON PAYLOAD: ", JSON.stringify(payload, null, 2));

    try {
      return await firstValueFrom(
        this.httpService.post(
          `${this.subMagicApiUrl}/v1/projects/${projectId}/export`,
          payload,
          { headers }
        )
      );
    } catch (error) {
      this.handleSubmagicApiError(error);
    }
  }

  private buildProjectPayload(dto: StartProjectDto): any {
    const webhookUrl =
      dto.webhookUrl || `${this.publicBaseUrl}/webhook/submagic`;

    if (isLocalUrl(webhookUrl)) {
      this.logger.warn(`Using local webhook URL: ${webhookUrl}`);
    }

    const payload: any = {
      language: dto.language || this.defaultLanguage,
      templateName: dto.templateName || this.defaultTemplateName,
      webhookUrl,
      magicZooms: toBool(dto.magicZooms, this.defaultMagicZooms),
      magicBrolls: toBool(dto.magicBrolls, this.defaultMagicBrolls),
      magicBrollsPercentage: toInt(
        dto.magicBrollsPercentage,
        this.defaultMagicBrollsPercentage
      ),
    };

    if (dto.title) {
      payload.title = dto.title;
    }

    if (dto.videoUrl) {
      payload.videoUrl = dto.videoUrl;
    } else {
      throw new BadRequestException("videoUrl must be provided");
    }

    const dictionary = normalizeDictionary(dto.dictionary);
    if (dictionary) {
      payload.dictionary = dictionary;
    }

    return payload;
  }

  private buildUpdateProjectPayload(dto: UpdateProjectDto): any {
    const payload: any = {};

    if (dto.removeSilencePace !== undefined) {
      payload.removeSilencePace = dto.removeSilencePace;
    }

    if (dto.removeBadTakes !== undefined) {
      payload.removeBadTakes = dto.removeBadTakes;
    }

    if (dto.items && dto.items.length > 0) {
      payload.items = dto.items.map((item) => ({
        type: "user-media",
        startTime: item.startTime,
        endTime: item.endTime,
        userMediaId: item.userMediaId,
      }));
    }

    return payload;
  }

  private async callSubmagicAPI(
    payload: any
  ): Promise<AxiosResponse> {
    // Remove videoFile from payload if it exists (we don't handle file uploads)
    const { videoFile, ...jsonPayload } = payload;

    const apiKey = await this.redisService.getSubmagicApiKey();
    if (!apiKey)
      throw new UnauthorizedException("Submagic API key is required");
    const headers = {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    };

    try {
      return await firstValueFrom(
        this.httpService.post(
          `${this.subMagicApiUrl}/v1/projects`,
          jsonPayload,
          { headers }
        )
      );
    } catch (error) {
      this.handleSubmagicApiError(error);
    }
  }

  private async callSubmagicUpdateAPI(
    projectId: string,
    payload: any
  ): Promise<AxiosResponse> {
    const apiKey = await this.redisService.getSubmagicApiKey();
    if (!apiKey)
      throw new UnauthorizedException("Submagic API key is required");
    const headers = {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    };

    try {
      return await firstValueFrom(
        this.httpService.put(
          `${this.subMagicApiUrl}/v1/projects/${projectId}`,
          payload,
          { headers }
        )
      );
    } catch (error) {
      this.handleSubmagicApiError(error);
    }
  }

  private handleSubmagicApiError(error: any): never {
    console.error("Submagic API Error:", error);
    if (error.response) {
      const { status, data } = error.response;
      const errorMessage =
        data?.message || data?.error || "Unknown error from Submagic API";
      const errorCode = data?.error;

      this.logger.error(
        `Submagic API error (${status}): ${errorMessage}`,
        data
      );

      switch (status) {
        case 400:
          throw new InvalidRequestException(errorMessage);
        case 401:
          throw new UnauthorizedException(errorMessage);
        case 402:
          if (errorCode === "INSUFFICIENT_CREDITS") {
            throw new InsufficientCreditsException(errorMessage);
          }
          throw new SubmagicApiException(errorMessage, status, errorCode);
        case 429:
          throw new RateLimitExceededException(errorMessage);
        case 500:
        case 502:
        case 503:
        case 504:
          throw new SubmagicServerException(errorMessage);
        default:
          throw new SubmagicApiException(errorMessage, status, errorCode);
      }
    }

    // Network or other errors
    this.logger.error("Network or unknown error calling Submagic API:", error);
    throw new InternalServerErrorException(
      "Failed to communicate with Submagic API"
    );
  }

  private generateProjectId(): string {
    const crypto = require("crypto");
    return crypto.randomBytes(16).toString("hex");
  }

  async uploadUserMedia(
    files: Express.Multer.File[],
    apiKeyOverride?: string
  ): Promise<
    {
      userMediaId: string;
      referencePath: string;
      item: { userMediaId: string; description: string; tags: string[] };
    }[]
  > {
    if (!files || files.length === 0) {
      throw new BadRequestException("No files provided");
    }

    const CONCURRENCY = 5;
    const results: {
      userMediaId: string;
      referencePath: string;
      item: { userMediaId: string; description: string; tags: string[] };
    }[] = [];

    try {
      for (let i = 0; i < files.length; i += CONCURRENCY) {
        const batch = files.slice(i, i + CONCURRENCY);
        // this.logger.log(`Uploading batch ${i / CONCURRENCY + 1} (${batch.length} files)`);
        const batchResults = await Promise.all(
          batch.map((file) =>
            this.uploadSingleFileWithRetry(file, apiKeyOverride, 3)
          )
        );
        results.push(...batchResults);
      }
      const existing = (await this.redisService.getMediaItems()) ?? [];
      const combinedMap: Map<
        string,
        { userMediaId: string; description: string; tags: string[] }
      > = new Map();
      const normalizedExisting = existing.map((e) => ({
        userMediaId: e.userMediaId,
        description: e.description,
        tags: e.tags ?? this.generateTagsFromDescription(e.description),
      }));
      for (const item of normalizedExisting)
        combinedMap.set(item.userMediaId, item);
      for (const res of results)
        combinedMap.set(res.item.userMediaId, res.item);
      const combined = Array.from(combinedMap.values());
      console.log("Saved Media Items", combined.length);
      await this.redisService.saveMediaItems(combined);
      return results;
    } catch (error) {
      this.logger.error(
        "Failed to upload one or more user media files:",
        error
      );
      if (
        error instanceof InternalServerErrorException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        "Failed to upload one or more user media files"
      );
    }
  }

  private async uploadSingleFile(
    file: Express.Multer.File,
    apiKeyOverride?: string
  ): Promise<{
    userMediaId: string;
    referencePath: string;
    item: { userMediaId: string; description: string; tags: string[] };
  }> {
    if (!file || (!file.buffer && !file.path)) {
      throw new BadRequestException("Invalid file payload");
    }

    const form = new FormDataLib();
    const content =
      file.buffer ?? (file.path ? fs.createReadStream(file.path) : undefined);
    form.append("file", content as any, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const apiKey = await this.redisService.getSubmagicApiKey();

    const headers = {
      "x-api-key": apiKey,
      ...form.getHeaders(),
    };

    const url = `${this.subMagicApiUrl}/v1/user-media/upload`;

    const httpsAgent = new https.Agent({ keepAlive: true });

    const response = await firstValueFrom(
      this.httpService.post(url, form, {
        headers,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 120000,
        httpsAgent,
      })
    );

    const userMediaId = response?.data?.userMediaId;
    if (!userMediaId) {
      throw new InternalServerErrorException(
        "Submagic did not return userMediaId"
      );
    }

    const description = this.filenameToDescription(file.originalname);
    const tags = this.generateTagsFromDescription(description);

    const item = { userMediaId, description, tags };
    const referencePath = "redis:mediaItems";
    return { userMediaId, referencePath, item };
  }

  private async uploadSingleFileWithRetry(
    file: Express.Multer.File,
    apiKeyOverride: string | undefined,
    retries: number
  ): Promise<{
    userMediaId: string;
    referencePath: string;
    item: { userMediaId: string; description: string; tags: string[] };
  }> {
    let attempt = 0;
    let lastError: any;
    while (attempt <= retries) {
      try {
        if (attempt > 0) {
          const delayMs = 1000 * Math.pow(2, attempt - 1);
          await new Promise((res) => setTimeout(res, delayMs));
          this.logger.warn(
            `Retrying upload for ${file.originalname} (attempt ${attempt + 1}/${
              retries + 1
            })`
          );
        }
        return await this.uploadSingleFile(file, apiKeyOverride);
      } catch (err: any) {
        lastError = err;
        // Retry on transient network errors
        const code = err?.code;
        const status = err?.response?.status;
        if (
          code === "ECONNRESET" ||
          code === "ETIMEDOUT" ||
          status === 502 ||
          status === 503 ||
          status === 504
        ) {
          attempt++;
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  private filenameToDescription(originalname: string): string {
    const base = path.parse(originalname).name;
    return base
      .replace(/[_\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  private generateTagsFromDescription(desc: string): string[] {
    // Simple tag inference: split, filter short tokens, unique
    const tokens = desc
      .split(/\W+/)
      .map((t) => t.toLowerCase())
      .filter((t) => t.length > 2);
    const base = Array.from(new Set(tokens));

    // Lightweight cues
    const boosters: Record<string, string[]> = {
      gym: ["fitness", "workout", "weights"],
      weight: ["weightloss", "scale", "fatloss"],
      ozempic: ["glp1", "medication", "injection"],
      doctor: ["medical", "health", "clinic"],
      salad: ["healthy", "food", "nutrition"],
      running: ["cardio", "jogging", "outdoors"],
      athlete: ["training", "strength", "sport"],
      phone: ["smartphone", "mobile", "texting"],
    };

    const extra = base.flatMap((t) => boosters[t] ?? []);
    const combined = Array.from(new Set([...base, ...extra]));

    // Keep list short and literal
    return combined.slice(0, 12);
  }

  private saveUploadedMediaReference(item: {
    userMediaId: string;
    description: string;
    tags: string[];
  }): string {
    const constantsDir = path.resolve(process.cwd(), "api/src/data");
    const tsPath = path.join(constantsDir, "uploaded-media-items.ts");

    // Ensure directory exists
    if (!fs.existsSync(constantsDir)) {
      fs.mkdirSync(constantsDir, { recursive: true });
    }

    // If file exists, append to array; else create a new file with starter export
    if (fs.existsSync(tsPath)) {
      const current = fs.readFileSync(tsPath, "utf8");

      // Naive append: insert before closing array
      const insert = `  {
    userMediaId: "${item.userMediaId}",
    description: "${item.description}",
    tags: ${JSON.stringify(item.tags)}
  },\n`;

      const updated = current.replace(/\];\s*$/m, `${insert}];`);
      fs.writeFileSync(tsPath, updated, "utf8");
    } else {
      const content = `import { MediaItemDto } from "../dto/media-matching.dto";

export const MEDIA_ITEMS: MediaItemDto[] = [
  {
    userMediaId: "${item.userMediaId}",
    description: "${item.description}",
    tags: ${JSON.stringify(item.tags)}
  },
];
`;
      fs.writeFileSync(tsPath, content, "utf8");
    }

    return tsPath;
  }
}
