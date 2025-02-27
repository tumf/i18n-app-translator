import * as fs from 'fs';
import { translate } from '../commands/translate';
import { Parser } from '../utils/parser';
import { Translator } from '../utils/translator';
import { Glossary } from '../utils/glossary';
import { createVectorDBClient } from '../utils/vectorDBClient';
import { ContextExtractor } from '../utils/contextExtractor';
import { jest } from '@jest/globals';
import logger from '../utils/logger';

// Mock dependencies
jest.mock('fs');
jest.mock('../utils/parser');
jest.mock('../utils/translator');
jest.mock('../utils/glossary');
jest.mock('../utils/vectorDBClient');
jest.mock('../utils/contextExtractor');
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
        create: jest.fn<any>().mockResolvedValue({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
        }),
      },
      chat: {
        completions: {
          create: jest.fn<any>().mockResolvedValue({
            choices: [{ message: { content: '{"translated": "翻訳されたテキスト"}' } }],
          }),
        },
      },
    })),
  };
});

describe('translate command', () => {
  // Setup mocks
  const mockParseI18nFile = jest.fn();
  const mockBuildI18nData = jest.fn();
  const mockSaveI18nFile = jest.fn();
  const mockBatchTranslate = jest.fn();
  const mockLoad = jest.fn();
  const mockGetAllEntries = jest.fn();
  const mockInitialize = jest.fn();
  const mockClose = jest.fn();
  const mockExtractContextForKeys = jest.fn();
  const mockFormatContextString = jest.fn();

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
      buildI18nData: mockBuildI18nData,
      saveI18nFile: mockSaveI18nFile,
    }));

    // Setup Translator mock
    (Translator as jest.Mock).mockImplementation(() => ({
      batchTranslate: mockBatchTranslate,
    }));

    // Setup Glossary mock
    (Glossary as jest.Mock).mockImplementation(() => ({
      load: mockLoad,
      getAllEntries: mockGetAllEntries,
    }));

    // Setup VectorDBClient mock
    (createVectorDBClient as jest.Mock).mockImplementation(() => ({
      initialize: mockInitialize,
      close: mockClose,
    }));

    // Setup ContextExtractor mock
    (ContextExtractor as jest.Mock).mockImplementation(() => ({
      extractContextForKeys: mockExtractContextForKeys.mockReturnValue(Promise.resolve(new Map())),
      formatContextString: mockFormatContextString.mockReturnValue('Mocked context from code'),
    }));

    // Mock fs.existsSync
    (fs.existsSync as jest.Mock).mockReturnValue(true);
  });

  test('should translate entries that do not exist in target file', async () => {
    // Mock source entries
    const sourceEntries = [
      { key: 'key1', value: 'value1', context: 'context1' },
      { key: 'key2', value: 'value2', context: 'context2' },
      { key: 'key3', value: 'value3', context: 'context3' },
    ];

    // Mock target entries (only has key1)
    const targetEntries = [{ key: 'key1', value: 'target1', context: 'context1' }];

    // Mock translation results
    const translationResults = new Map([
      ['key2', { translated: 'translated2' }],
      ['key3', { translated: 'translated3' }],
    ]);

    // Setup mock return values
    mockParseI18nFile.mockImplementation((file: any) => {
      if (String(file).includes('source')) return Promise.resolve(sourceEntries);
      if (String(file).includes('target')) return Promise.resolve(targetEntries);
      return Promise.resolve([]);
    });

    mockBatchTranslate.mockReturnValue(Promise.resolve(translationResults as any));
    mockGetAllEntries.mockReturnValue([]);
    mockBuildI18nData.mockReturnValue({ mock: 'data' });

    // Call the translate function
    await translate({
      source: 'source.json',
      dest: 'target.json',
      lang: 'ja',
    });

    // Verify parser was called correctly
    expect(mockParseI18nFile).toHaveBeenCalledTimes(2);
    expect(mockParseI18nFile).toHaveBeenCalledWith('source.json');
    expect(mockParseI18nFile).toHaveBeenCalledWith('target.json');

    // Verify translator was called correctly
    expect(mockBatchTranslate).toHaveBeenCalledWith(
      [
        { key: 'key2', value: 'value2', context: 'context2' },
        { key: 'key3', value: 'value3', context: 'context3' },
      ],
      'ja',
      {
        useVectorDB: true,
        useGlossary: true,
        context: '',
        concurrency: 5,
        showProgress: true,
        similarTranslationsLimit: 3,
        debug: false,
      },
    );

    // Verify the result was saved
    expect(mockBuildI18nData).toHaveBeenCalledWith([
      { key: 'key1', value: 'target1', context: 'context1' },
      { key: 'key2', value: 'translated2', context: 'context2' },
      { key: 'key3', value: 'translated3', context: 'context3' },
    ]);
    expect(mockSaveI18nFile).toHaveBeenCalledWith('target.json', { mock: 'data' });
  });

  test('should create new target file if it does not exist', async () => {
    // Mock source entries
    const sourceEntries = [{ key: 'key1', value: 'value1', context: 'context1' }];

    // Mock translation results
    const translationResults = new Map([['key1', { translated: 'translated1' }]]);

    // Setup mock return values
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    mockParseI18nFile.mockReturnValueOnce(Promise.resolve(sourceEntries as any));
    mockBatchTranslate.mockReturnValue(Promise.resolve(translationResults as any));
    mockBuildI18nData.mockReturnValue({ mock: 'data' });

    // Call the translate function
    await translate({
      source: 'source.json',
      dest: 'target.json',
      lang: 'ja',
    });

    // Verify parser was called correctly
    expect(mockParseI18nFile).toHaveBeenCalledTimes(1);
    expect(mockParseI18nFile).toHaveBeenCalledWith('source.json');

    // Verify the result was saved
    expect(mockBuildI18nData).toHaveBeenCalledWith([
      { key: 'key1', value: 'translated1', context: 'context1' },
    ]);
    expect(mockSaveI18nFile).toHaveBeenCalledWith('target.json', { mock: 'data' });
  });

  test('should handle errors gracefully', async () => {
    // Mock process.exit
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Process.exit called with code ${code}`);
    });

    // Setup mock to throw an error
    mockParseI18nFile.mockRejectedValue(new Error('Test error') as never);

    // Mock console.error
    const originalConsoleError = console.error;
    console.error = jest.fn();

    // Mock logger.error
    const originalLoggerError = logger.error;
    logger.error = jest.fn();

    // Execute and verify
    await expect(
      translate({
        source: 'source.json',
        dest: 'target.json',
        lang: 'ja',
      }),
    ).rejects.toThrow('Process.exit called with code 1');

    // Verify error was logged
    expect(logger.error).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(1);

    // Restore mocks
    console.error = originalConsoleError;
    logger.error = originalLoggerError;
  });

  test('should extract context from code when contextFromCode option is provided', async () => {
    // Mock source entries
    const sourceEntries = [
      { key: 'key1', value: 'value1', context: 'context1' },
      { key: 'key2', value: 'value2', context: 'context2' },
    ];

    // Mock target entries (empty)
    const targetEntries: any[] = [];

    // Mock translation results
    const translationResults = new Map([
      ['key1', { translated: 'translated1' }],
      ['key2', { translated: 'translated2' }],
    ]);

    // Setup mock return values
    mockParseI18nFile.mockImplementation((file: any) => {
      if (String(file).includes('source')) return Promise.resolve(sourceEntries);
      if (String(file).includes('target')) return Promise.resolve(targetEntries);
      return Promise.resolve([]);
    });

    mockBatchTranslate.mockReturnValue(Promise.resolve(translationResults as any));
    mockGetAllEntries.mockReturnValue([]);
    mockBuildI18nData.mockReturnValue({ mock: 'data' });

    // Call the translate function with contextFromCode option
    await translate({
      source: 'source.json',
      dest: 'target.json',
      lang: 'ja',
      contextFromCode: './src',
    });

    // Verify ContextExtractor was instantiated
    expect(ContextExtractor).toHaveBeenCalledWith('./src');

    // Verify extractContextForKeys was called
    expect(mockExtractContextForKeys).toHaveBeenCalled();

    // Verify formatContextString was called
    expect(mockFormatContextString).toHaveBeenCalled();

    // Verify translator was called with context that includes the extracted context
    expect(mockBatchTranslate).toHaveBeenCalledWith(
      expect.anything(),
      'ja',
      expect.objectContaining({
        context: expect.stringContaining('Mocked context from code'),
      }),
    );
  });
});
