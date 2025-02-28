import { getLLMModel, getEmbeddingModel } from '../../utils/aiClient';
import { openai } from '@ai-sdk/openai';
import configManager from '../../utils/config';

// Mock dependencies
jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn().mockReturnValue('mocked-llm'),
  embedding: jest.fn().mockReturnValue('mocked-embedding'),
}));

jest.mock('../../utils/config', () => ({
  getConfig: jest.fn(),
}));

// Save original environment
const originalEnv = process.env;

describe('aiClient', () => {
  // Reset mocks and environment before each test
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };

    // Mock openai.embedding
    openai.embedding = jest.fn().mockReturnValue('mocked-embedding');
  });

  // Restore original environment after all tests
  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getLLMModel', () => {
    test('should use environment variable if available', () => {
      // Setup
      process.env.TRANSLATION_LLM = 'gpt-4-turbo';

      // Execute
      const result = getLLMModel();

      // Verify
      expect(openai).toHaveBeenCalledWith('gpt-4-turbo');
      expect(result).toBe('mocked-llm');
    });

    test('should use config if environment variable is not available', () => {
      // Setup
      delete process.env.TRANSLATION_LLM;
      (configManager.getConfig as jest.Mock).mockReturnValue({
        translation: {
          llmProvider: 'gpt-3.5-turbo',
        },
      });

      // Execute
      const result = getLLMModel();

      // Verify
      expect(openai).toHaveBeenCalledWith('gpt-3.5-turbo');
      expect(result).toBe('mocked-llm');
    });

    test('should use default if neither environment variable nor config is available', () => {
      // Setup
      delete process.env.TRANSLATION_LLM;
      (configManager.getConfig as jest.Mock).mockReturnValue({});

      // Execute
      const result = getLLMModel();

      // Verify
      expect(openai).toHaveBeenCalledWith('gpt-4o');
      expect(result).toBe('mocked-llm');
    });

    test('should throw error if openai throws', () => {
      // Setup
      delete process.env.TRANSLATION_LLM;
      (configManager.getConfig as jest.Mock).mockReturnValue({});
      // Cast to unknown first to avoid TypeScript error
      (openai as unknown as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid model');
      });

      // Execute & Verify
      expect(() => getLLMModel()).toThrow('Invalid LLM provider');
    });
  });

  describe('getEmbeddingModel', () => {
    test('should use environment variable if available', () => {
      // Setup
      process.env.EMBEDDING_LLM = 'text-embedding-ada-002';

      // Execute
      const result = getEmbeddingModel();

      // Verify
      expect(openai.embedding).toHaveBeenCalledWith('text-embedding-ada-002');
      expect(result).toBe('mocked-embedding');
    });

    test('should use config if environment variable is not available', () => {
      // Setup
      delete process.env.EMBEDDING_LLM;
      (configManager.getConfig as jest.Mock).mockReturnValue({
        translation: {
          embeddingProvider: 'text-embedding-3-large',
        },
      });

      // Execute
      const result = getEmbeddingModel();

      // Verify
      expect(openai.embedding).toHaveBeenCalledWith('text-embedding-3-large');
      expect(result).toBe('mocked-embedding');
    });

    test('should use default if neither environment variable nor config is available', () => {
      // Setup
      delete process.env.EMBEDDING_LLM;
      (configManager.getConfig as jest.Mock).mockReturnValue({});

      // Execute
      const result = getEmbeddingModel();

      // Verify
      expect(openai.embedding).toHaveBeenCalledWith('text-embedding-3-small');
      expect(result).toBe('mocked-embedding');
    });

    test('should throw error if openai.embedding throws', () => {
      // Setup
      delete process.env.EMBEDDING_LLM;
      (configManager.getConfig as jest.Mock).mockReturnValue({});
      // Cast to unknown first to avoid TypeScript error
      (openai.embedding as unknown as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid model');
      });

      // Execute & Verify
      expect(() => getEmbeddingModel()).toThrow('Invalid embedding provider');
    });
  });
});
