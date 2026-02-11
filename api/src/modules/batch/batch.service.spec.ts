import { Test, TestingModule } from '@nestjs/testing';
import { BatchService } from './batch.service';
import { ProjectService } from '../project/project.service';
import { SubmagicService } from '../submagic/submagic.service';
import { Logger } from '@nestjs/common';

describe('BatchService', () => {
  let service: BatchService;
  let projectService: ProjectService;
  let submagicService: SubmagicService;

  const mockProjectService = {
    createBatch: jest.fn(),
    updateBatchStatus: jest.fn(),
    saveProject: jest.fn(),
  };

  const mockSubmagicService = {
    startProject: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchService,
        {
          provide: ProjectService,
          useValue: mockProjectService,
        },
        {
          provide: SubmagicService,
          useValue: mockSubmagicService,
        },
      ],
    }).compile();

    service = module.get<BatchService>(BatchService);
    projectService = module.get<ProjectService>(ProjectService);
    submagicService = module.get<SubmagicService>(SubmagicService);

    // Mock logger to avoid console noise
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startBatch', () => {
    const userId = 'user-123';
    const dto = {
      videos: [
        { title: 'Video 1', videoUrl: 'http://example.com/1.mp4' },
        { title: 'Video 2', videoUrl: 'http://example.com/2.mp4' },
      ],
      language: 'en',
      templateName: 'default',
    };

    it('should create a batch and return batchId immediately', async () => {
      mockProjectService.createBatch.mockResolvedValue(undefined);
      // Spy on the private method to prevent actual execution during this test if desired,
      // or just let it run (it's async fire-and-forget).
      // Ideally we mock it to verify it's called.
      const processSpy = jest.spyOn(service as any, 'processBatchInBackground').mockResolvedValue(undefined);

      const result = await service.startBatch(dto, userId);

      expect(result).toHaveProperty('batchId');
      expect(result.projectIds).toEqual([]);
      expect(mockProjectService.createBatch).toHaveBeenCalledTimes(1);
      expect(mockProjectService.createBatch).toHaveBeenCalledWith(expect.objectContaining({
        userId,
        status: 'pending',
        totalCount: 2,
      }));
      expect(processSpy).toHaveBeenCalledWith(result.batchId, dto, userId, undefined);
    });
  });

  describe('processBatchInBackground', () => {
    const userId = 'user-123';
    const batchId = 'batch-123';
    const dto = {
      videos: [
        { title: 'Video 1', videoUrl: 'http://example.com/1.mp4' },
        { title: 'Video 2', videoUrl: 'http://example.com/2.mp4' },
      ],
      language: 'en',
      templateName: 'default',
      magicBrolls: true,
    };

    it('should process all videos successfully', async () => {
      mockProjectService.updateBatchStatus.mockResolvedValue(undefined);
      mockSubmagicService.startProject
        .mockResolvedValueOnce({ projectId: 'p1' })
        .mockResolvedValueOnce({ projectId: 'p2' });
      mockProjectService.saveProject.mockResolvedValue(undefined);

      await (service as any).processBatchInBackground(batchId, dto, userId);

      expect(mockProjectService.updateBatchStatus).toHaveBeenCalledWith(batchId, 'processing');
      expect(mockSubmagicService.startProject).toHaveBeenCalledTimes(2);
      expect(mockProjectService.saveProject).toHaveBeenCalledTimes(2);
      
      // Check first project save
      expect(mockProjectService.saveProject).toHaveBeenCalledWith(expect.objectContaining({
        id: 'p1',
        title: 'Video 1',
        batchId: batchId,
        magicBrolls: false, // Expect false as per implementation (delayed B-roll)
      }));

      // Check batch completion update
      expect(mockProjectService.updateBatchStatus).toHaveBeenLastCalledWith(
        batchId, 
        'completed', 
        expect.objectContaining({
          completedCount: 2,
          failedCount: 0,
        })
      );
    });

    it('should handle partial failure', async () => {
      mockProjectService.updateBatchStatus.mockResolvedValue(undefined);
      
      // First succeeds, second fails
      mockSubmagicService.startProject.mockResolvedValueOnce({ projectId: 'p1' });
      mockSubmagicService.startProject.mockRejectedValueOnce(new Error('Processing failed'));
      
      mockProjectService.saveProject.mockResolvedValue(undefined);

      await (service as any).processBatchInBackground(batchId, dto, userId);

      expect(mockSubmagicService.startProject).toHaveBeenCalledTimes(2);
      expect(mockProjectService.saveProject).toHaveBeenCalledTimes(1); // Only for success
      
      // Check batch completion update
      expect(mockProjectService.updateBatchStatus).toHaveBeenLastCalledWith(
        batchId, 
        'completed_with_errors', 
        expect.objectContaining({
          completedCount: 1,
          failedCount: 1,
        })
      );
    });
  });
});
