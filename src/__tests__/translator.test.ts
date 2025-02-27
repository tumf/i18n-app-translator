import { Translator } from '../utils/translator';
import { generateTranslation, reviewTranslation } from '../utils/aiClient';
import type { IVectorDBClient } from '../utils/vectorDBClient';
import type { I18nEntry } from '../utils/parser';
import type { Glossary } from '../utils/glossary';
import { jest } from '@jest/globals';
import logger from '../utils/logger';

// Mock dependencies
jest.mock('../utils/aiClient', () => {
  return {
    generateTranslation: jest.fn().mockImplementation(() => Promise.resolve('mocked translation')),
    reviewTranslation: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ improved: 'improved translation', changes: 'mocked changes' }),
      ),
  };
});

jest.mock('../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Translator', () => {
  // Setup mocks
  const mockVectorDBClient = {
    initialize: jest.fn().mockImplementation(() => Promise.resolve()),
    addTranslation: jest.fn().mockImplementation(() => Promise.resolve()),
    findSimilarTranslations: jest.fn().mockImplementation(() => Promise.resolve([])),
    close: jest.fn().mockImplementation(() => Promise.resolve()),
  } as unknown as jest.Mocked<IVectorDBClient>;

  const mockGlossary = {
    load: jest.fn().mockImplementation(() => Promise.resolve()),
    getEntriesForLanguage: jest.fn().mockImplementation(() => ({})),
    getAllEntries: jest.fn().mockImplementation(() => []),
    filePath: '',
    entries: [],
    save: jest.fn().mockImplementation(() => Promise.resolve()),
    addEntry: jest.fn(),
    removeEntry: jest.fn().mockImplementation(() => true),
    searchEntries: jest.fn().mockImplementation(() => []),
  } as unknown as jest.Mocked<Glossary>;

  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('translateEntry', () => {
    test('should translate an entry with vector DB and glossary', async () => {
      // Setup
      const translator = new Translator(mockVectorDBClient, mockGlossary);
      const entry: I18nEntry = { key: 'test', value: 'Hello', context: 'greeting' };
      const similarTranslations: Array<{
        source: string;
        translation: string;
        similarity: number;
      }> = [{ source: 'Hi', translation: 'こんにちは', similarity: 0.9 }];
      const glossaryTerms = { Hello: 'こんにちは' };

      // Mock return values
      mockVectorDBClient.findSimilarTranslations.mockResolvedValue(similarTranslations);
      mockGlossary.getEntriesForLanguage.mockReturnValue(glossaryTerms);
      (generateTranslation as jest.Mock).mockImplementation(() => Promise.resolve('こんにちは'));

      // Execute
      const result = await translator.translateEntry(entry, 'ja');

      // Verify
      expect(mockVectorDBClient.findSimilarTranslations).toHaveBeenCalledWith('Hello', 'ja', 3);
      expect(mockGlossary.getEntriesForLanguage).toHaveBeenCalledWith('ja');
      expect(generateTranslation).toHaveBeenCalledWith(
        'Hello',
        'ja',
        'greeting',
        similarTranslations,
        glossaryTerms,
        false,
      );
      expect(mockVectorDBClient.addTranslation).toHaveBeenCalledWith(
        'Hello',
        'こんにちは',
        'ja',
        'greeting',
      );
      expect(result).toEqual({
        original: 'Hello',
        translated: 'こんにちは',
        isNew: true,
      });
    });

    test('should translate an entry without vector DB', async () => {
      // Setup
      const translator = new Translator(mockVectorDBClient, mockGlossary);
      const entry: I18nEntry = { key: 'test', value: 'Hello', context: 'greeting' };
      const glossaryTerms = { Hello: 'こんにちは' };

      // Mock return values
      mockGlossary.getEntriesForLanguage.mockReturnValue(glossaryTerms);
      (generateTranslation as jest.Mock).mockImplementation(() => Promise.resolve('こんにちは'));

      // Execute
      const result = await translator.translateEntry(entry, 'ja', { useVectorDB: false });

      // Verify
      expect(mockVectorDBClient.findSimilarTranslations).not.toHaveBeenCalled();
      expect(mockGlossary.getEntriesForLanguage).toHaveBeenCalledWith('ja');
      expect(generateTranslation).toHaveBeenCalledWith(
        'Hello',
        'ja',
        'greeting',
        undefined,
        glossaryTerms,
        false,
      );
      expect(mockVectorDBClient.addTranslation).not.toHaveBeenCalled();
      expect(result).toEqual({
        original: 'Hello',
        translated: 'こんにちは',
        isNew: true,
      });
    });

    test('should translate an entry without glossary', async () => {
      // Setup
      const translator = new Translator(mockVectorDBClient, mockGlossary);
      const entry: I18nEntry = { key: 'test', value: 'Hello', context: 'greeting' };
      const similarTranslations: Array<{
        source: string;
        translation: string;
        similarity: number;
      }> = [{ source: 'Hi', translation: 'こんにちは', similarity: 0.9 }];

      // Mock return values
      mockVectorDBClient.findSimilarTranslations.mockResolvedValue(similarTranslations);
      (generateTranslation as jest.Mock).mockImplementation(() => Promise.resolve('こんにちは'));

      // Execute
      const result = await translator.translateEntry(entry, 'ja', { useGlossary: false });

      // Verify
      expect(mockVectorDBClient.findSimilarTranslations).toHaveBeenCalledWith('Hello', 'ja', 3);
      expect(mockGlossary.getEntriesForLanguage).not.toHaveBeenCalled();
      expect(generateTranslation).toHaveBeenCalledWith(
        'Hello',
        'ja',
        'greeting',
        similarTranslations,
        undefined,
        false,
      );
      expect(mockVectorDBClient.addTranslation).toHaveBeenCalledWith(
        'Hello',
        'こんにちは',
        'ja',
        'greeting',
      );
      expect(result).toEqual({
        original: 'Hello',
        translated: 'こんにちは',
        isNew: true,
      });
    });

    test('should handle errors when finding similar translations', async () => {
      // Setup
      const translator = new Translator(mockVectorDBClient, mockGlossary);
      const entry: I18nEntry = { key: 'test', value: 'Hello', context: 'greeting' };
      const glossaryTerms = { Hello: 'こんにちは' };

      // Mock return values
      mockVectorDBClient.findSimilarTranslations.mockRejectedValue(new Error('Test error'));
      mockGlossary.getEntriesForLanguage.mockReturnValue(glossaryTerms);
      (generateTranslation as jest.Mock).mockImplementation(() => Promise.resolve('こんにちは'));

      // Execute
      const result = await translator.translateEntry(entry, 'ja');

      // Verify
      expect(mockVectorDBClient.findSimilarTranslations).toHaveBeenCalledWith('Hello', 'ja', 3);
      expect(logger.warn).toHaveBeenCalled();
      expect(mockGlossary.getEntriesForLanguage).toHaveBeenCalledWith('ja');
      expect(generateTranslation).toHaveBeenCalledWith(
        'Hello',
        'ja',
        'greeting',
        [],
        glossaryTerms,
        false,
      );
      expect(mockVectorDBClient.addTranslation).toHaveBeenCalledWith(
        'Hello',
        'こんにちは',
        'ja',
        'greeting',
      );
      expect(result).toEqual({
        original: 'Hello',
        translated: 'こんにちは',
        isNew: true,
      });
    });

    test('should handle errors when getting glossary terms', async () => {
      // Setup
      const translator = new Translator(mockVectorDBClient, mockGlossary);
      const entry: I18nEntry = { key: 'test', value: 'Hello', context: 'greeting' };
      const similarTranslations: Array<{
        source: string;
        translation: string;
        similarity: number;
      }> = [{ source: 'Hi', translation: 'こんにちは', similarity: 0.9 }];

      // Mock return values
      mockVectorDBClient.findSimilarTranslations.mockResolvedValue(similarTranslations);
      mockGlossary.getEntriesForLanguage.mockImplementation(() => {
        throw new Error('Test error');
      });
      (generateTranslation as jest.Mock).mockImplementation(() => Promise.resolve('こんにちは'));

      // Execute
      const result = await translator.translateEntry(entry, 'ja');

      // Verify
      expect(mockVectorDBClient.findSimilarTranslations).toHaveBeenCalledWith('Hello', 'ja', 3);
      expect(mockGlossary.getEntriesForLanguage).toHaveBeenCalledWith('ja');
      expect(logger.warn).toHaveBeenCalled();
      expect(generateTranslation).toHaveBeenCalledWith(
        'Hello',
        'ja',
        'greeting',
        similarTranslations,
        {},
        false,
      );
      expect(mockVectorDBClient.addTranslation).toHaveBeenCalledWith(
        'Hello',
        'こんにちは',
        'ja',
        'greeting',
      );
      expect(result).toEqual({
        original: 'Hello',
        translated: 'こんにちは',
        isNew: true,
      });
    });

    test('should handle errors when storing translation in vector DB', async () => {
      // Setup
      const translator = new Translator(mockVectorDBClient, mockGlossary);
      const entry: I18nEntry = { key: 'test', value: 'Hello', context: 'greeting' };
      const similarTranslations: Array<{
        source: string;
        translation: string;
        similarity: number;
      }> = [{ source: 'Hi', translation: 'こんにちは', similarity: 0.9 }];
      const glossaryTerms = { Hello: 'こんにちは' };

      // Mock return values
      mockVectorDBClient.findSimilarTranslations.mockResolvedValue(similarTranslations);
      mockGlossary.getEntriesForLanguage.mockReturnValue(glossaryTerms);
      (generateTranslation as jest.Mock).mockImplementation(() => Promise.resolve('こんにちは'));
      mockVectorDBClient.addTranslation.mockRejectedValue(new Error('Test error'));

      // Execute
      const result = await translator.translateEntry(entry, 'ja');

      // Verify
      expect(mockVectorDBClient.findSimilarTranslations).toHaveBeenCalledWith('Hello', 'ja', 3);
      expect(mockGlossary.getEntriesForLanguage).toHaveBeenCalledWith('ja');
      expect(generateTranslation).toHaveBeenCalledWith(
        'Hello',
        'ja',
        'greeting',
        similarTranslations,
        glossaryTerms,
        false,
      );
      expect(mockVectorDBClient.addTranslation).toHaveBeenCalledWith(
        'Hello',
        'こんにちは',
        'ja',
        'greeting',
      );
      expect(logger.warn).toHaveBeenCalled();
      expect(result).toEqual({
        original: 'Hello',
        translated: 'こんにちは',
        isNew: true,
      });
    });
  });

  describe('reviewEntry', () => {
    test('should review an entry with glossary', async () => {
      // Setup
      const translator = new Translator(mockVectorDBClient, mockGlossary);
      const sourceEntry: I18nEntry = { key: 'test', value: 'Hello', context: 'greeting' };
      const targetEntry: I18nEntry = { key: 'test', value: 'こんにちは', context: 'greeting' };
      const glossaryTerms = { Hello: 'こんにちは' };
      const reviewResult: { improved: string; changes: string } = {
        improved: 'こんにちは！',
        changes: 'Added exclamation mark',
      };

      // Mock return values
      mockGlossary.getEntriesForLanguage.mockReturnValue(glossaryTerms);
      (reviewTranslation as jest.Mock).mockImplementation(() => Promise.resolve(reviewResult));

      // Execute
      const result = await translator.reviewEntry(sourceEntry, targetEntry, 'ja');

      // Verify
      expect(mockGlossary.getEntriesForLanguage).toHaveBeenCalledWith('ja');
      expect(reviewTranslation).toHaveBeenCalledWith(
        'Hello',
        'こんにちは',
        'ja',
        'greeting',
        glossaryTerms,
      );
      expect(mockVectorDBClient.addTranslation).toHaveBeenCalledWith(
        'Hello',
        'こんにちは！',
        'ja',
        'greeting',
      );
      expect(result).toEqual({
        original: 'Hello',
        translated: 'こんにちは！',
        isNew: false,
        changes: 'Added exclamation mark',
      });
    });

    test('should not store improved translation if it is the same as the original', async () => {
      // Setup
      const translator = new Translator(mockVectorDBClient, mockGlossary);
      const sourceEntry: I18nEntry = { key: 'test', value: 'Hello', context: 'greeting' };
      const targetEntry: I18nEntry = { key: 'test', value: 'こんにちは', context: 'greeting' };
      const glossaryTerms = { Hello: 'こんにちは' };
      const reviewResult = { improved: 'こんにちは', changes: 'No changes needed' };

      // Mock return values
      mockGlossary.getEntriesForLanguage.mockReturnValue(glossaryTerms);
      (reviewTranslation as jest.Mock).mockImplementation(() => Promise.resolve(reviewResult));

      // Execute
      const result = await translator.reviewEntry(sourceEntry, targetEntry, 'ja');

      // Verify
      expect(mockGlossary.getEntriesForLanguage).toHaveBeenCalledWith('ja');
      expect(reviewTranslation).toHaveBeenCalledWith(
        'Hello',
        'こんにちは',
        'ja',
        'greeting',
        glossaryTerms,
      );
      expect(mockVectorDBClient.addTranslation).not.toHaveBeenCalled();
      expect(result).toEqual({
        original: 'Hello',
        translated: 'こんにちは',
        isNew: false,
        changes: 'No changes needed',
      });
    });

    test('should handle errors when getting glossary terms', async () => {
      // Setup
      const translator = new Translator(mockVectorDBClient, mockGlossary);
      const sourceEntry: I18nEntry = { key: 'test', value: 'Hello', context: 'greeting' };
      const targetEntry: I18nEntry = { key: 'test', value: 'こんにちは', context: 'greeting' };
      const reviewResult: { improved: string; changes: string } = {
        improved: 'こんにちは！',
        changes: 'Added exclamation mark',
      };

      // Mock return values
      mockGlossary.getEntriesForLanguage.mockImplementation(() => {
        throw new Error('Test error');
      });
      (reviewTranslation as jest.Mock).mockImplementation(() => Promise.resolve(reviewResult));

      // Execute
      const result = await translator.reviewEntry(sourceEntry, targetEntry, 'ja');

      // Verify
      expect(mockGlossary.getEntriesForLanguage).toHaveBeenCalledWith('ja');
      expect(logger.warn).toHaveBeenCalled();
      expect(reviewTranslation).toHaveBeenCalledWith('Hello', 'こんにちは', 'ja', 'greeting', {});
      expect(mockVectorDBClient.addTranslation).toHaveBeenCalledWith(
        'Hello',
        'こんにちは！',
        'ja',
        'greeting',
      );
      expect(result).toEqual({
        original: 'Hello',
        translated: 'こんにちは！',
        isNew: false,
        changes: 'Added exclamation mark',
      });
    });

    test('should handle errors when storing improved translation in vector DB', async () => {
      // Setup
      const translator = new Translator(mockVectorDBClient, mockGlossary);
      const sourceEntry: I18nEntry = { key: 'test', value: 'Hello', context: 'greeting' };
      const targetEntry: I18nEntry = { key: 'test', value: 'こんにちは', context: 'greeting' };
      const glossaryTerms = { Hello: 'こんにちは' };
      const reviewResult: { improved: string; changes: string } = {
        improved: 'こんにちは！',
        changes: 'Added exclamation mark',
      };

      // Mock return values
      mockGlossary.getEntriesForLanguage.mockReturnValue(glossaryTerms);
      (reviewTranslation as jest.Mock).mockImplementation(() => Promise.resolve(reviewResult));
      mockVectorDBClient.addTranslation.mockRejectedValue(new Error('Test error'));

      // Execute
      const result = await translator.reviewEntry(sourceEntry, targetEntry, 'ja');

      // Verify
      expect(mockGlossary.getEntriesForLanguage).toHaveBeenCalledWith('ja');
      expect(reviewTranslation).toHaveBeenCalledWith(
        'Hello',
        'こんにちは',
        'ja',
        'greeting',
        glossaryTerms,
      );
      expect(mockVectorDBClient.addTranslation).toHaveBeenCalledWith(
        'Hello',
        'こんにちは！',
        'ja',
        'greeting',
      );
      expect(logger.warn).toHaveBeenCalled();
      expect(result).toEqual({
        original: 'Hello',
        translated: 'こんにちは！',
        isNew: false,
        changes: 'Added exclamation mark',
      });
    });
  });

  describe('batchTranslate', () => {
    test('should translate multiple entries with concurrency control', async () => {
      // Setup
      const translator = new Translator(mockVectorDBClient, mockGlossary);
      const entries: I18nEntry[] = [
        { key: 'key1', value: 'Hello', context: 'greeting' },
        { key: 'key2', value: 'Goodbye', context: 'farewell' },
      ];

      // Mock translateEntry method
      const translateEntrySpy = jest.spyOn(translator, 'translateEntry');
      translateEntrySpy.mockImplementation(async (entry) => {
        return {
          original: entry.value,
          translated: entry.key === 'key1' ? 'こんにちは' : 'さようなら',
          isNew: true,
        };
      });

      // Execute
      const results = await translator.batchTranslate(entries, 'ja', { concurrency: 1 });

      // Verify
      expect(translateEntrySpy).toHaveBeenCalledTimes(2);
      // Check that translateEntry was called with the correct entries, but don't check the exact options
      expect(translateEntrySpy).toHaveBeenCalledWith(
        expect.objectContaining(entries[0]),
        'ja',
        expect.any(Object),
      );
      expect(translateEntrySpy).toHaveBeenCalledWith(
        expect.objectContaining(entries[1]),
        'ja',
        expect.any(Object),
      );
      expect(results.size).toBe(2);
      expect(results.get('key1')).toEqual({
        original: 'Hello',
        translated: 'こんにちは',
        isNew: true,
      });
      expect(results.get('key2')).toEqual({
        original: 'Goodbye',
        translated: 'さようなら',
        isNew: true,
      });
    });

    test('should handle errors during batch translation', async () => {
      // Setup
      const translator = new Translator(mockVectorDBClient, mockGlossary);
      const entries: I18nEntry[] = [
        { key: 'key1', value: 'Hello', context: 'greeting' },
        { key: 'key2', value: 'Goodbye', context: 'farewell' },
      ];

      // Mock translateEntry method
      const translateEntrySpy = jest.spyOn(translator, 'translateEntry');
      translateEntrySpy.mockImplementation(async (entry) => {
        if (entry.key === 'key1') {
          return {
            original: entry.value,
            translated: 'こんにちは',
            isNew: true,
          };
        } else {
          throw new Error('Test error');
        }
      });

      // Mock console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Execute
      const results = await translator.batchTranslate(entries, 'ja', { concurrency: 1 });

      // Verify
      expect(translateEntrySpy).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(results.size).toBe(1);
      expect(results.get('key1')).toEqual({
        original: 'Hello',
        translated: 'こんにちは',
        isNew: true,
      });
      expect(results.has('key2')).toBe(false);

      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });

  describe('batchReview', () => {
    test('should review multiple entries with concurrency control', async () => {
      // Setup
      const translator = new Translator(mockVectorDBClient, mockGlossary);
      const sourceEntries: I18nEntry[] = [
        { key: 'key1', value: 'Hello', context: 'greeting' },
        { key: 'key2', value: 'Goodbye', context: 'farewell' },
      ];
      const targetEntries: I18nEntry[] = [
        { key: 'key1', value: 'こんにちは', context: 'greeting' },
        { key: 'key2', value: 'さようなら', context: 'farewell' },
      ];

      // Mock reviewEntry method
      const reviewEntrySpy = jest.spyOn(translator, 'reviewEntry');
      reviewEntrySpy.mockImplementation(async (sourceEntry, _targetEntry) => {
        return {
          original: sourceEntry.value,
          translated: sourceEntry.key === 'key1' ? 'こんにちは！' : 'さようなら！',
          isNew: false,
          changes: 'Added exclamation mark',
        };
      });

      // Execute
      const results = await translator.batchReview(sourceEntries, targetEntries, 'ja', {
        concurrency: 1,
      });

      // Verify
      expect(reviewEntrySpy).toHaveBeenCalledTimes(2);
      // Check that reviewEntry was called with the correct entries, but don't check the exact options
      expect(reviewEntrySpy).toHaveBeenCalledWith(
        expect.objectContaining(sourceEntries[0]),
        expect.objectContaining(targetEntries[0]),
        'ja',
        expect.any(Object),
      );
      expect(reviewEntrySpy).toHaveBeenCalledWith(
        expect.objectContaining(sourceEntries[1]),
        expect.objectContaining(targetEntries[1]),
        'ja',
        expect.any(Object),
      );
      expect(results.size).toBe(2);
      expect(results.get('key1')).toEqual({
        original: 'Hello',
        translated: 'こんにちは！',
        isNew: false,
        changes: 'Added exclamation mark',
      });
      expect(results.get('key2')).toEqual({
        original: 'Goodbye',
        translated: 'さようなら！',
        isNew: false,
        changes: 'Added exclamation mark',
      });
    });

    test('should handle errors during batch review', async () => {
      // Setup
      const translator = new Translator(mockVectorDBClient, mockGlossary);
      const sourceEntries: I18nEntry[] = [
        { key: 'key1', value: 'Hello', context: 'greeting' },
        { key: 'key2', value: 'Goodbye', context: 'farewell' },
      ];
      const targetEntries: I18nEntry[] = [
        { key: 'key1', value: 'こんにちは', context: 'greeting' },
        { key: 'key2', value: 'さようなら', context: 'farewell' },
      ];

      // Mock reviewEntry method
      const reviewEntrySpy = jest.spyOn(translator, 'reviewEntry');
      reviewEntrySpy.mockImplementation(async (sourceEntry, _targetEntry) => {
        if (sourceEntry.key === 'key1') {
          return {
            original: sourceEntry.value,
            translated: 'こんにちは！',
            isNew: false,
            changes: 'Added exclamation mark',
          };
        } else {
          throw new Error('Test error');
        }
      });

      // Mock console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Execute
      const results = await translator.batchReview(sourceEntries, targetEntries, 'ja', {
        concurrency: 1,
      });

      // Verify
      expect(reviewEntrySpy).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(results.size).toBe(1);
      expect(results.get('key1')).toEqual({
        original: 'Hello',
        translated: 'こんにちは！',
        isNew: false,
        changes: 'Added exclamation mark',
      });
      expect(results.has('key2')).toBe(false);

      // Restore console.error
      consoleErrorSpy.mockRestore();
    });

    test('should filter out source entries that do not have matching target entries', async () => {
      // Setup
      const translator = new Translator(mockVectorDBClient, mockGlossary);
      const sourceEntries: I18nEntry[] = [
        { key: 'key1', value: 'Hello', context: 'greeting' },
        { key: 'key2', value: 'Goodbye', context: 'farewell' },
        { key: 'key3', value: 'Thank you', context: 'gratitude' },
      ];
      const targetEntries: I18nEntry[] = [
        { key: 'key1', value: 'こんにちは', context: 'greeting' },
        { key: 'key2', value: 'さようなら', context: 'farewell' },
      ];

      // Mock reviewEntry method
      const reviewEntrySpy = jest.spyOn(translator, 'reviewEntry');
      reviewEntrySpy.mockImplementation(async (sourceEntry, _targetEntry) => {
        return {
          original: sourceEntry.value,
          translated: sourceEntry.key === 'key1' ? 'こんにちは！' : 'さようなら！',
          isNew: false,
          changes: 'Added exclamation mark',
        };
      });

      // Execute
      const results = await translator.batchReview(sourceEntries, targetEntries, 'ja', {
        concurrency: 1,
      });

      // Verify
      expect(reviewEntrySpy).toHaveBeenCalledTimes(2);
      expect(reviewEntrySpy).not.toHaveBeenCalledWith(
        sourceEntries[2],
        expect.anything(),
        'ja',
        expect.anything(),
      );
      expect(results.size).toBe(2);
      expect(results.has('key3')).toBe(false);
    });
  });
});
