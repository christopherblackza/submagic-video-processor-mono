import { 
  Controller, 
  Get,
  Post,
  Param,
  Body,
  NotFoundException,
  Logger,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { SubmagicService } from '../submagic/submagic.service';
import { UpdateProjectDto, ExportProjectDto } from '../../common/dto/start-project.dto';
import { formatDate } from '../../common/utils/helpers';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { ProjectService } from './project.service';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller()
@UseGuards(SupabaseAuthGuard)
export class ProjectController {
  private readonly logger = new Logger(ProjectController.name);

  constructor(
    private readonly projectService: ProjectService,
    private readonly submagicService: SubmagicService
  ) {}

  @Get('project/:projectId')
  @ApiOperation({ summary: 'Get project status page' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Project status page' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getProjectStatus(@Request() req, @Param('projectId') projectId: string, @Res() res: Response) {
    this.logger.log(`Getting project status for ${projectId}`);
    const userId = req.user.id;
    
    const project = await this.projectService.syncProjectStatus(projectId);
    if (!project || project.userId !== userId) {
      throw new NotFoundException('Project not found');
    }

    const completion = await this.projectService.getCompletion(projectId);
    
    const templateData = {
      project: {
        ...project,
        formattedCreatedAt: formatDate(project.createdAt),
        formattedCompletedAt: formatDate(project.completedAt),
      },
      completion,
      isCompleted: project.status === 'completed' || project.status === 'failed',
      hasDownload: completion?.downloadUrl && project.status === 'completed',
    };

    // For API responses, return JSON
    if (res.req.headers.accept?.includes('application/json')) {
      return res.json(templateData);
    }

    // For browser requests, render HTML (if we had templates configured)
    // For now, return JSON with a note about HTML rendering
    return res.json({
      ...templateData,
      note: 'HTML rendering would be available with view engine configuration',
    });
  }

  @Post('project/:projectId/update')
  @ApiOperation({ summary: 'Update project with B-roll items' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Project updated successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiBody({ type: UpdateProjectDto })
  async updateProjectWithBrolls(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() updateDto: UpdateProjectDto
  ) {
    this.logger.log(`Updating project ${projectId} with B-roll items xD`);
    const userId = req.user.id;
    
    const project = await this.projectService.getProject(projectId);
    if (!project || project.userId !== userId) {
      throw new NotFoundException('Project not found');
    }

    // Call Submagic API to update the project
    const result = await this.submagicService.updateProject(projectId, updateDto, userId);
    
    this.logger.log(`Project ${projectId} updated successfully`);
    return result;
  }

  @Post('project/:projectId/export')
  @ApiOperation({ summary: 'Export a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Project export started successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async exportProject(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() exportProjectDto: ExportProjectDto
  ) {
    this.logger.log(`Exporting project: ${projectId}`);
    const userId = req.user.id;
    const token = req.token;
    
    const project = await this.projectService.getProject(projectId);
    if (!project || project.userId !== userId) {
      throw new NotFoundException('Project not found');
    }
    
    try {
      const result = await this.submagicService.exportProject(projectId, exportProjectDto, userId, token);
      this.logger.log(`Project ${projectId} export started successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to export project ${projectId}:`, error);
      throw error;
    }
  }

  @Get('project/:projectId/details')
  @ApiOperation({ summary: 'Get project details from Submagic API' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Project details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid API key' })
  async getProjectDetails(
    @Request() req,
    @Param('projectId') projectId: string
  ) {
    this.logger.log(`Getting project details from Submagic API for ${projectId}`);
    const userId = req.user.id;

    // Verify ownership first
    const project = await this.projectService.getProject(projectId);
    if (!project || project.userId !== userId) {
      throw new NotFoundException('Project not found');
    }
    
    try {
      const result = await this.submagicService.getProject(projectId, userId);
      this.logger.log(`Project details retrieved for ${projectId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to get project details for ${projectId}:`, error);
      throw error;
    }
  }

  @Get('completion/:projectId')
  @ApiOperation({ summary: 'Get project completion page' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Project completion page' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getCompletionPage(@Request() req, @Param('projectId') projectId: string, @Res() res: Response) {
    this.logger.log(`Getting completion page for ${projectId}`);
    const userId = req.user.id;
    
    const project = await this.projectService.syncProjectStatus(projectId);
    if (!project || project.userId !== userId) {
      throw new NotFoundException('Project not found');
    }

    const completion = await this.projectService.getCompletion(projectId);
    
    const isCompleted = project.status === 'completed';
    const isFailed = project.status === 'failed';
    const isProcessing = !isCompleted && !isFailed;

    const templateData = {
      project: {
        ...project,
        formattedCreatedAt: formatDate(project.createdAt),
        formattedCompletedAt: formatDate(project.completedAt),
      },
      completion,
      status: {
        isCompleted,
        isFailed,
        isProcessing,
      },
      hasDownload: completion?.downloadUrl && isCompleted,
      downloadUrl: completion?.downloadUrl,
    };

    // For API responses, return JSON
    if (res.req.headers.accept?.includes('application/json')) {
      return res.json(templateData);
    }

    // For browser requests, render HTML (if we had templates configured)
    // For now, return JSON with a note about HTML rendering
    return res.json({
      ...templateData,
      note: 'HTML rendering would be available with view engine configuration',
    });
  }
}