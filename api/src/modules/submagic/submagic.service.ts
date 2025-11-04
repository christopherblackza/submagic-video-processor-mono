import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse, AxiosError } from 'axios';
import { Project } from '../../common/interfaces/project.interface';
import { StartProjectDto, UpdateProjectDto, ExportProjectDto } from '../../common/dto/start-project.dto';
import { normalizeDictionary, toBool, toInt, sanitizeHeaders, isLocalUrl } from '../../common/utils/helpers';
import { 
  SubmagicApiException, 
  InsufficientCreditsException, 
  InvalidRequestException, 
  UnauthorizedException, 
  RateLimitExceededException, 
  SubmagicServerException 
} from '../../common/exceptions/submagic-api.exceptions';

@Injectable()
export class SubmagicService {
  private readonly logger = new Logger(SubmagicService.name);
  private readonly apiKey: string;
  private readonly publicBaseUrl: string;
  private readonly defaultLanguage: string;
  private readonly defaultTemplateName: string;
  private readonly defaultMagicZooms: boolean;
  private readonly defaultMagicBrolls: boolean;
  private readonly defaultMagicBrollsPercentage: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiKey = this.configService.get<string>('SUBMAGIC_API_KEY') || '';
    this.publicBaseUrl = this.configService.get<string>('PUBLIC_BASE_URL') || '';
    this.defaultLanguage = this.configService.get<string>('DEFAULT_LANGUAGE', 'en');
    this.defaultTemplateName = this.configService.get<string>('DEFAULT_TEMPLATE_NAME', 'Hormozi 2');
    this.defaultMagicZooms = this.configService.get<boolean>('DEFAULT_MAGIC_ZOOMS', true);
    this.defaultMagicBrolls = this.configService.get<boolean>('DEFAULT_MAGIC_BROLLS', true);
    this.defaultMagicBrollsPercentage = this.configService.get<number>('DEFAULT_MAGIC_BROLLS_PERCENTAGE', 60);
    console.error('API KEY: ', this.apiKey);

    if (!this.apiKey) {
      this.logger.error('SUBMAGIC_API_KEY is required');
      throw new Error('SUBMAGIC_API_KEY is required');
    }
    if (!this.publicBaseUrl) {
      this.logger.error('PUBLIC_BASE_URL is required');
      throw new Error('PUBLIC_BASE_URL is required');
    }
  }

  async startProject(dto: StartProjectDto): Promise<{ projectId: string }> {
    try {
      const payload = this.buildProjectPayload(dto);
      
      // this.logger.debug(`Payload: ${JSON.stringify(sanitizeHeaders(payload), null, 2)}`);

      const response = await this.callSubmagicAPI(payload);
      console.log('RESPONSE: ', response);
      
      // Extract the project ID from the Submagic API response
      const projectId = response.data.id;
      
      if (!projectId) {
        throw new InternalServerErrorException('Submagic API did not return a project ID');
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
      throw new InternalServerErrorException('Failed to start video processing');
    }
  }

  async updateProject(projectId: string, dto: UpdateProjectDto): Promise<{ message: string; id: string; status: string }> {
    try {
      const payload = this.buildUpdateProjectPayload(dto);
      
      this.logger.debug(`Update payload for project ${projectId}: ${JSON.stringify(payload, null, 2)}`);

      const response = await this.callSubmagicUpdateAPI(projectId, payload);
      console.log('UPDATE RESPONSE: ', response);
      
      this.logger.log(`Project ${projectId} updated successfully`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to update project ${projectId}:`, error);
      
      // Re-throw the error if it's already a SubmagicApiException
      if (error instanceof SubmagicApiException) {
        throw error;
      }
      
      // For any other errors, throw a generic internal server error
      throw new InternalServerErrorException('Failed to update project');
    }
  }

  async exportProject(projectId: string, exportData: ExportProjectDto): Promise<any> {
    try {
      this.logger.log(`Exporting project: ${projectId}`);
      
      const payload = this.buildExportProjectPayload(exportData);
      // this.logger.log(`Export payload: ${JSON.stringify(payload, null, 2)}`);
      
      const response = await this.callSubmagicExportAPI(projectId, payload);
      this.logger.log(`Export response: ${JSON.stringify(response.data, null, 2)}`);
      
      return response.data;
    } catch (error) {
      this.logger.error('Error exporting project:', error);
      throw new InternalServerErrorException('Failed to export project');
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
      throw new InternalServerErrorException('Failed to get project details');
    }
  }

  private async callSubmagicGetAPI(projectId: string): Promise<AxiosResponse> {
    const headers = {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
    };

    console.log("GET PROJECT HEADERS: ", headers);

    try {
      const response = await firstValueFrom(
        this.httpService.get(`https://api.submagic.co/v1/projects/${projectId}`, { headers })
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

  private async callSubmagicExportAPI(projectId: string, payload: any): Promise<any> {
    const headers = {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
    };

    console.log("EXPORT HEADERS: ", headers);
    console.log("EXPORT JSON PAYLOAD: ", JSON.stringify(payload, null, 2));

    try {
      return await firstValueFrom(
        this.httpService.post(`https://api.submagic.co/v1/projects/${projectId}/export`, payload, { headers })
      );
    } catch (error) {
      this.handleSubmagicApiError(error);
    }
  }

  private buildProjectPayload(dto: StartProjectDto): any {
    const webhookUrl = dto.webhookUrl || `${this.publicBaseUrl}/webhook/submagic`;
    
    if (isLocalUrl(webhookUrl)) {
      this.logger.warn(`Using local webhook URL: ${webhookUrl}`);
    }

    const payload: any = {
      language: dto.language || this.defaultLanguage,
      templateName: dto.templateName || this.defaultTemplateName,
      webhookUrl,
      magicZooms: toBool(dto.magicZooms, this.defaultMagicZooms),
      magicBrolls: toBool(dto.magicBrolls, this.defaultMagicBrolls),
      magicBrollsPercentage: toInt(dto.magicBrollsPercentage, this.defaultMagicBrollsPercentage),
    };

    if (dto.title) {
      payload.title = dto.title;
    }

    if (dto.videoUrl) {
      payload.videoUrl = dto.videoUrl;
    } else {
      throw new BadRequestException('videoUrl must be provided');
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
      payload.items = dto.items.map(item => ({
        startTime: item.startTime,
        endTime: item.endTime,
        userMediaId: item.userMediaId
      }));
    }

    return payload;
  }

  private async callSubmagicAPI(payload: any): Promise<AxiosResponse> {
    // Remove videoFile from payload if it exists (we don't handle file uploads)
    const { videoFile, ...jsonPayload } = payload;

    const headers = {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
    };

    console.log("HEADERS: ", headers);
    console.log("JSON PAYLOAD: ", JSON.stringify(jsonPayload, null, 2));

    try {
      return await firstValueFrom(
        this.httpService.post('https://api.submagic.co/v1/projects', jsonPayload, { headers })
      );
    } catch (error) {
      this.handleSubmagicApiError(error);
    }
  }

  private async callSubmagicUpdateAPI(projectId: string, payload: any): Promise<AxiosResponse> {
    const headers = {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
    };

    console.log("UPDATE HEADERS: ", headers);
    console.log("UPDATE JSON PAYLOAD: ", JSON.stringify(payload, null, 2));

    try {
      return await firstValueFrom(
        this.httpService.put(`https://api.submagic.co/v1/projects/${projectId}`, payload, { headers })
      );
    } catch (error) {
      this.handleSubmagicApiError(error);
    }
  }

  private handleSubmagicApiError(error: any): never {
    console.error("Submagic API Error:", error);
    if (error.response) {
      const { status, data } = error.response;
      const errorMessage = data?.message || data?.error || 'Unknown error from Submagic API';
      const errorCode = data?.error;

      this.logger.error(`Submagic API error (${status}): ${errorMessage}`, data);

      switch (status) {
        case 400:
          throw new InvalidRequestException(errorMessage);
        case 401:
          throw new UnauthorizedException(errorMessage);
        case 402:
          if (errorCode === 'INSUFFICIENT_CREDITS') {
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
    this.logger.error('Network or unknown error calling Submagic API:', error);
    throw new InternalServerErrorException('Failed to communicate with Submagic API');
  }

  private generateProjectId(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(16).toString('hex');
  }
}