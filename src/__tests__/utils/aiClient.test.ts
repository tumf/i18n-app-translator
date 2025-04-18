import { getLLMModel, getEmbeddingModel } from '../../utils/aiClient';
import { openai } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import configManager from '../../utils/config';

// Mock dependencies
jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn().mockReturnValue('mocked-llm'),
  embedding: jest.fn().mockReturnValue('mocked-embedding'),
}));

jest.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: jest.fn().mockReturnValue({
    chatModel: jest.fn().mockReturnValue('mocked-openrouter-llm'),
    textEmbeddingModel: jest.fn().mockReturnValue('mocked-openrouter-embedding'),
  }),
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
  
  describe('getLLMModel with OpenRouter', () => {
    test('should use OpenRouter provider when LLM_PROVIDER is set to openrouter', () => {
      // Setup
      process.env.LLM_PROVIDER = 'openrouter';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      process.env.TRANSLATION_LLM = 'claude-3-opus';

      // Execute
      const result = getLLMModel();

      // Verify
      expect(createOpenAICompatible).toHaveBeenCalledWith({
        baseURL: 'https://openrouter.ai/api/v1',
        name: 'openrouter',
        apiKey: 'test-openrouter-key',
      });
      expect(result).toBe('mocked-openrouter-llm');

      delete process.env.LLM_PROVIDER;
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.TRANSLATION_LLM;
    });
    
    test('should use OpenRouter provider when providerType is set to openrouter in config', () => {
      // Setup
      delete process.env.LLM_PROVIDER;
      (configManager.getConfig as jest.Mock).mockReturnValue({
        translation: {
          providerType: 'openrouter',
          llmProvider: 'claude-3-haiku',
        },
      });
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

      // Execute
      const result = getLLMModel();

      // Verify
      expect(createOpenAICompatible).toHaveBeenCalledWith({
        baseURL: 'https://openrouter.ai/api/v1',
        name: 'openrouter',
        apiKey: 'test-openrouter-key',
      });
      expect(result).toBe('mocked-openrouter-llm');

      delete process.env.OPENROUTER_API_KEY;
    });
  });
  
  describe('getEmbeddingModel with OpenRouter', () => {
    test('should use OpenRouter provider when LLM_PROVIDER is set to openrouter', () => {
      // Setup
      process.env.LLM_PROVIDER = 'openrouter';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      process.env.EMBEDDING_LLM = 'text-embedding-3-large';

      // Execute
      const result = getEmbeddingModel();

      // Verify
      expect(createOpenAICompatible).toHaveBeenCalledWith({
        baseURL: 'https://openrouter.ai/api/v1',
        name: 'openrouter',
        apiKey: 'test-openrouter-key',
      });
      expect(result).toBe('mocked-openrouter-embedding');

      delete process.env.LLM_PROVIDER;
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.EMBEDDING_LLM;
    });
  });
});
