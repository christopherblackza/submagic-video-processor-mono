import { Test, TestingModule } from '@nestjs/testing';
import { ProjectService } from './project.service';
import { SupabaseService } from '../supabase/supabase.service';
import { Logger } from '@nestjs/common';

describe('ProjectService', () => {
  let service: ProjectService;
  let supabaseService: SupabaseService;

  const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
  };

  const mockSupabaseService = {
    getServiceRoleClient: jest.fn().mockReturnValue(mockSupabaseClient),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
    supabaseService = module.get<SupabaseService>(SupabaseService);

    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    // Reset all mocks to return this by default
    Object.values(mockSupabaseClient).forEach(mock => {
      mock.mockReturnThis();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBatch', () => {
    it('should insert a batch into the database', async () => {
      const batch = {
        id: 'batch-123',
        userId: 'user-123',
        createdAt: new Date().toISOString(),
        status: 'pending',
        totalCount: 5,
        completedCount: 0,
        failedCount: 0,
        projects: [],
        templateName: 'test',
      };

      mockSupabaseClient.insert.mockResolvedValue({ error: null });

      await service.createBatch(batch);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('batches');
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(expect.objectContaining({
        id: batch.id,
        user_id: batch.userId,
        status: 'pending',
      }));
    });

    it('should throw error if insert fails', async () => {
      const batch = {
        id: 'batch-123',
        userId: 'user-123',
        createdAt: new Date().toISOString(),
        status: 'pending',
        totalCount: 5,
        completedCount: 0,
        failedCount: 0,
        projects: [],
        templateName: 'test',
      };

      mockSupabaseClient.insert.mockResolvedValue({ error: { message: 'DB Error' } });

      await expect(service.createBatch(batch)).rejects.toThrow('Failed to create batch');
    });
  });

  describe('updateBatchStatus', () => {
    it('should update batch status', async () => {
      const batchId = 'batch-123';
      const status = 'processing';

      mockSupabaseClient.update.mockReturnThis();
      mockSupabaseClient.eq.mockResolvedValue({ error: null });

      await service.updateBatchStatus(batchId, status);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('batches');
      expect(mockSupabaseClient.update).toHaveBeenCalledWith(expect.objectContaining({
        status,
      }));
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', batchId);
    });
  });

  describe('getBatch', () => {
    it('should return a batch if found', async () => {
      const batchId = 'batch-123';
      const mockDbBatch = {
        id: batchId,
        user_id: 'user-123',
        status: 'completed',
        created_at: '2023-01-01T00:00:00Z',
        metadata: {
          totalCount: 2,
          completedCount: 2,
        },
        projects: [],
      };

      mockSupabaseClient.single.mockResolvedValue({ data: mockDbBatch, error: null });

      const result = await service.getBatch(batchId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(batchId);
      expect(result?.status).toBe('completed');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('batches');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', batchId);
    });

    it('should return undefined if batch not found', async () => {
      const batchId = 'non-existent';
      mockSupabaseClient.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      const result = await service.getBatch(batchId);

      expect(result).toBeUndefined();
    });
  });
});
