import fs from 'fs';
import { importData } from '../commands/import';
import { Parser } from '../utils/parser';
import { Glossary } from '../utils/glossary';
import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('fs');
jest.mock('../utils/parser');
jest.mock('../utils/glossary');

// Mock process.exit
jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null | undefined) => {
  throw new Error(`Process.exit called with code ${code}`);
});

// Mock fs.promises.readFile
(fs.promises as any) = {
  readFile: jest.fn().mockImplementation((path: string) => {
    if (path.includes('glossary')) {
      return Promise.resolve(
        JSON.stringify([
          { term: 'hello', translation: 'a greeting' },
          { term: 'goodbye', translation: 'a farewell' },
        ]),
      );
    } else if (path.includes('translations')) {
      return Promise.resolve(
        JSON.stringify({
          hello: 'hola',
          goodbye: 'adiós',
        }),
      );
    }
    return Promise.resolve('{}');
  }),
};

describe('import command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
  });

  describe('error handling', () => {
    it('should handle missing source file', async () => {
      // Setup mocks
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      // Call the function and expect it to throw
      await expect(
        importData({
          source: 'nonexistent.json',
          type: 'glossary',
          sourceLanguage: 'en',
        }),
      ).rejects.toThrow('Process.exit called with code 1');

      // Verify error was logged
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle missing target language for translations', async () => {
      // Setup mocks
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Call the function and expect it to throw
      await expect(
        importData({
          source: 'translations.json',
          type: 'translations',
          dest: 'output.json',
          sourceLanguage: 'en',
        }),
      ).rejects.toThrow('Process.exit called with code 1');

      // Verify error was logged
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('glossary import', () => {
    it('should handle glossary import correctly', async () => {
      // Setup mocks
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const mockAddEntry = jest.fn();
      const mockLoad = jest.fn();
      const mockSave = jest.fn();

      // Setup Glossary mock
      (Glossary as jest.Mock).mockImplementation(() => ({
        load: mockLoad,
        addEntry: mockAddEntry,
        save: mockSave,
      }));

      // Patch process.exit for this test only
      const originalExit = process.exit;
      process.exit = jest.fn() as any;

      try {
        // Call the function
        await importData({
          source: 'path/to/glossary.json',
          type: 'glossary',
          sourceLanguage: 'en',
        });

        // Verify glossary was loaded
        expect(mockLoad).toHaveBeenCalled();

        // Verify glossary entries were added
        expect(mockAddEntry).toHaveBeenCalledTimes(2);

        // Verify glossary was saved
        expect(mockSave).toHaveBeenCalled();
      } finally {
        // Restore process.exit
        process.exit = originalExit;
      }
    });
  });

  describe('translations import', () => {
    it('should handle translations import correctly', async () => {
      // Setup mocks
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const mockParseI18nFile = jest.fn().mockReturnValue([]);
      const mockBuildI18nData = jest.fn().mockReturnValue({});
      const mockSaveI18nFile = jest.fn();

      // Setup Parser mock
      (Parser as jest.Mock).mockImplementation(() => ({
        parseI18nFile: mockParseI18nFile,
        buildI18nData: mockBuildI18nData,
        saveI18nFile: mockSaveI18nFile,
      }));

      // Patch process.exit for this test only
      const originalExit = process.exit;
      process.exit = jest.fn() as any;

      try {
        // Call the function
        await importData({
          source: 'path/to/translations.json',
          type: 'translations',
          dest: 'output.json',
          sourceLanguage: 'en',
          targetLanguage: 'es',
        });

        // Verify translations were parsed and saved
        expect(mockBuildI18nData).toHaveBeenCalled();
        expect(mockSaveI18nFile).toHaveBeenCalled();
      } finally {
        // Restore process.exit
        process.exit = originalExit;
      }
    });
  });
});
