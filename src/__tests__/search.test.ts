import { search } from '../commands/search';
import { createVectorDBClient } from '../utils/vectorDBClient';
import { jest } from '@jest/globals';

// Mock process.exit
const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
  throw new Error(`Process.exit called with code ${code}`);
});

// Mock dependencies
jest.mock('../utils/vectorDBClient');
jest.mock('../utils/aiClient', () => ({
  getAIClient: jest.fn().mockReturnValue({
    generateTranslation: jest.fn(),
    reviewTranslation: jest.fn(),
  }),
}));

// Mock OpenAI
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      embeddings: {
        create: jest.fn(),
      },
    })),
  };
});

describe('search command', () => {
  // Setup mocks
  const mockInitialize = jest.fn();
  const mockFindSimilarTranslations = jest.fn();
  const mockClose = jest.fn();

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Setup VectorDBClient mock
    (createVectorDBClient as jest.Mock).mockImplementation(() => ({
      initialize: mockInitialize,
      findSimilarTranslations: mockFindSimilarTranslations,
      close: mockClose,
    }));
  });

  test('should search for similar translations', async () => {
    // Mock search results
    const searchResults = [
      {
        source: 'Hello',
        target: 'こんにちは',
        context: 'greeting',
        score: 0.95,
      },
      {
        source: 'Hi there',
        target: 'やあ',
        context: 'casual greeting',
        score: 0.85,
      },
    ];

    // Setup mock return values
    mockFindSimilarTranslations.mockReturnValue(Promise.resolve(searchResults));

    // Call the search function
    await search({
      query: 'Hello',
      lang: 'ja',
      limit: 2,
    });

    // Verify vector DB client was initialized
    expect(mockInitialize).toHaveBeenCalled();

    // Verify search was performed
    expect(mockFindSimilarTranslations).toHaveBeenCalledWith('Hello', 'ja', 2);

    // Verify vector DB client was closed
    expect(mockClose).toHaveBeenCalled();
  });

  test('should handle empty search results', async () => {
    // Setup mock to return empty results
    mockFindSimilarTranslations.mockReturnValue(Promise.resolve([]));

    // Call the search function
    await search({
      query: 'NonExistentTerm',
      lang: 'ja',
    });

    // Verify search was performed
    expect(mockFindSimilarTranslations).toHaveBeenCalledWith('NonExistentTerm', 'ja', 5);

    // Verify console output
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('No similar translations found'),
    );
  });

  test('should handle errors gracefully', async () => {
    // Setup mock to throw an error
    mockInitialize.mockRejectedValue(new Error('Test error') as never);

    // Mock console.error
    console.error = jest.fn();

    // Execute and verify
    await expect(
      search({
        query: 'Hello',
        lang: 'ja',
      }),
    ).rejects.toThrow('Process.exit called with code 1');

    // Verify error was logged
    expect(console.error).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
