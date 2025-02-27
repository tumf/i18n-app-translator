import * as fs from 'fs';
import { buildVector } from '../commands/build-vector';
import { Parser } from '../utils/parser';
import { createVectorDBClient } from '../utils/vectorDBClient';
import { jest } from '@jest/globals';

// Mock process.exit
const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
  throw new Error(`Process.exit called with code ${code}`);
});

// Mock dependencies
jest.mock('fs');
jest.mock('../utils/parser');
jest.mock('../utils/vectorDBClient');
jest.mock('../utils/aiClient', () => ({
  getAIClient: jest.fn().mockReturnValue({
    generateTranslation: jest.fn(),
    reviewTranslation: jest.fn(),
  }),
}));

// Mock Vercel AI SDK
jest.mock('ai', () => {
  return {
    embed: jest.fn().mockImplementation(() =>
      Promise.resolve({
        embedding: [0.1, 0.2, 0.3],
      }),
    ),
  };
});

// Mock OpenAI provider from Vercel AI SDK
jest.mock('@ai-sdk/openai', () => {
  return {
    openai: {
      embedding: jest.fn().mockReturnValue('mocked-embedding-model'),
    },
  };
});

describe('build-vector command', () => {
  // Setup mocks
  const mockParseI18nFile = jest.fn();
  const mockInitialize = jest.fn();
  const mockAddTranslationPair = jest.fn();
  const mockClose = jest.fn();

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Setup Parser mock
    (Parser as jest.Mock).mockImplementation(() => ({
      parseI18nFile: mockParseI18nFile,
    }));

    // Setup VectorDBClient mock
    (createVectorDBClient as jest.Mock).mockImplementation(() => ({
      initialize: mockInitialize,
      addTranslation: mockAddTranslationPair,
      close: mockClose,
    }));

    // Mock fs.existsSync
    (fs.existsSync as jest.Mock).mockReturnValue(true);
  });

  test('should build vector database from source and target files', async () => {
    // Mock source entries
    const sourceEntries = [
      { key: 'key1', value: 'value1', context: 'context1' },
      { key: 'key2', value: 'value2', context: 'context2' },
    ];

    // Mock target entries
    const targetEntries = [
      { key: 'key1', value: 'target1', context: 'context1' },
      { key: 'key2', value: 'target2', context: 'context2' },
    ];

    // Setup mock return values
    mockParseI18nFile.mockImplementation((file: any) => {
      if (String(file).includes('source')) return Promise.resolve(sourceEntries);
      if (String(file).includes('target')) return Promise.resolve(targetEntries);
      return Promise.resolve([]);
    });

    // Call the build-vector function
    await buildVector({
      source: 'source.json',
      target: 'target.json',
      targetLanguage: 'ja',
      batchSize: 10,
    });

    // Verify parser was called correctly
    expect(mockParseI18nFile).toHaveBeenCalledTimes(2);
    expect(mockParseI18nFile).toHaveBeenCalledWith('source.json');
    expect(mockParseI18nFile).toHaveBeenCalledWith('target.json');

    // Verify vector DB client was initialized
    expect(mockInitialize).toHaveBeenCalled();

    // Verify translation pairs were added
    expect(mockAddTranslationPair).toHaveBeenCalledTimes(2);
    expect(mockAddTranslationPair).toHaveBeenCalledWith('value1', 'target1', 'ja', 'context1');
    expect(mockAddTranslationPair).toHaveBeenCalledWith('value2', 'target2', 'ja', 'context2');

    // Verify vector DB client was closed
    expect(mockClose).toHaveBeenCalled();
  });

  test('should handle missing files', async () => {
    // Setup mock to simulate missing file
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    // Mock console.error
    console.error = jest.fn();

    // Execute and verify
    await expect(
      buildVector({
        source: 'source.json',
        target: 'target.json',
        targetLanguage: 'ja',
      }),
    ).rejects.toThrow('Process.exit called with code 1');

    // Verify error was logged
    expect(console.error).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  test('should handle errors gracefully', async () => {
    // Setup mock to throw an error
    mockParseI18nFile.mockRejectedValue(new Error('Test error') as never);

    // Mock console.error
    console.error = jest.fn();

    // Execute and verify
    await expect(
      buildVector({
        source: 'source.json',
        target: 'target.json',
        targetLanguage: 'ja',
      }),
    ).rejects.toThrow('Process.exit called with code 1');

    // Verify error was logged
    expect(console.error).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
