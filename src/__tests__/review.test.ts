import fs from 'fs';
import { review } from '../commands/review';
import { Parser } from '../utils/parser';
import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('fs');
jest.mock('../utils/parser');
jest.mock('../utils/translator');
jest.mock('../utils/glossary');
jest.mock('../utils/vectorDBClient');
jest.mock('../utils/aiClient', () => ({
  getAIClient: jest.fn().mockReturnValue({
    generateTranslation: jest.fn(),
    reviewTranslation: jest.fn(),
  }),
}));

// Mock process.exit
jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null | undefined) => {
  throw new Error(`Process.exit called with code ${code}`);
});

// Mock OpenAI
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      embeddings: {
        create: jest.fn().mockResolvedValue({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
        }),
      },
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content:
                    '{"improved": "改善されたテキスト", "score": 0.9, "feedback": "良い翻訳です"}',
                },
              },
            ],
          }),
        },
      },
    })),
  };
});

describe('review command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
  });

  it('should review translations that exist in both source and target files', async () => {
    // Setup mocks
    const mockSourceEntries = [
      { key: 'greeting', value: 'Hello' },
      { key: 'farewell', value: 'Goodbye' },
    ];

    const mockTargetEntries = [
      { key: 'greeting', value: 'Hola' },
      { key: 'farewell', value: 'Adiós' },
    ];

    // Mock fs.existsSync to return true for both files
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    // Mock Parser.parseI18nFile to return the mock entries
    const mockParseI18nFile = jest
      .fn()
      .mockResolvedValueOnce(mockSourceEntries)
      .mockResolvedValueOnce(mockTargetEntries);

    (Parser.prototype.parseI18nFile as jest.Mock) = mockParseI18nFile;

    // Call the function and expect it to throw
    await expect(
      review({
        source: 'en.json',
        dest: 'es.json',
        lang: 'es',
      }),
    ).rejects.toThrow('Process.exit called with code 1');

    // Verify Parser.parseI18nFile was called for both files
    expect(mockParseI18nFile).toHaveBeenCalledTimes(2);
    expect(mockParseI18nFile).toHaveBeenCalledWith('en.json');
    expect(mockParseI18nFile).toHaveBeenCalledWith('es.json');
  });

  it('should handle missing target file', async () => {
    // Mock fs.existsSync to return false for target file
    (fs.existsSync as jest.Mock)
      .mockReturnValueOnce(true) // Source file exists
      .mockReturnValueOnce(false); // Target file doesn't exist

    // Call the function and expect it to throw
    await expect(
      review({
        source: 'en.json',
        dest: 'nonexistent.json',
        lang: 'es',
      }),
    ).rejects.toThrow('Process.exit called with code 1');

    // Verify error was logged
    expect(console.error).toHaveBeenCalled();
  });
});
