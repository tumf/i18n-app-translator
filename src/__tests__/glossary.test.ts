import fs from 'fs';
import path from 'path';
import type { IGlossaryEntry } from '../utils/glossary';
import { Glossary } from '../utils/glossary';
import { jest } from '@jest/globals';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
  },
}));
jest.mock('path');

describe('Glossary', () => {
  // Test variables
  const testFilePath = '/test/glossary.json';
  let glossary: Glossary;

  // Sample entries
  const sampleEntries: IGlossaryEntry[] = [
    {
      term: 'hello',
      translations: { ja: 'こんにちは', fr: 'bonjour' },
      context: 'greeting',
    },
    {
      term: 'goodbye',
      translations: { ja: 'さようなら', fr: 'au revoir' },
      context: 'farewell',
    },
  ];

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Create a new glossary instance for each test
    glossary = new Glossary(testFilePath);
  });

  describe('load', () => {
    test('should load glossary from file when file exists', async () => {
      // Mock fs.existsSync to return true
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Mock fs.promises.readFile to return sample entries
      (fs.promises.readFile as jest.Mock).mockResolvedValue(JSON.stringify(sampleEntries));

      // Call the load method
      await glossary.load();

      // Verify fs methods were called correctly
      expect(fs.existsSync).toHaveBeenCalledWith(testFilePath);
      expect(fs.promises.readFile).toHaveBeenCalledWith(testFilePath, 'utf8');

      // Verify entries were loaded correctly
      expect(glossary.getAllEntries()).toEqual(sampleEntries);
    });

    test('should create new glossary when file does not exist', async () => {
      // Mock fs.existsSync to return false
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      // Mock fs.promises.writeFile to do nothing
      (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);

      // Call the load method
      await glossary.load();

      // Verify fs methods were called correctly
      expect(fs.existsSync).toHaveBeenCalledWith(testFilePath);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Glossary file not found'));

      // Verify save was called to create empty file
      expect(fs.promises.writeFile).toHaveBeenCalled();

      // Verify entries are empty
      expect(glossary.getAllEntries()).toEqual([]);
    });

    test('should handle errors when loading glossary', async () => {
      // Mock fs.existsSync to return true
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Mock fs.promises.readFile to throw an error
      const testError = new Error('Test error');
      (fs.promises.readFile as jest.Mock).mockRejectedValue(testError);

      // Call the load method and expect it to throw
      await expect(glossary.load()).rejects.toThrow(testError);

      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error loading glossary'));
    });
  });

  describe('save', () => {
    test('should save glossary to file', async () => {
      // Mock path.dirname to return directory path
      (path.dirname as jest.Mock).mockReturnValue('/test');

      // Mock fs.existsSync to return true for directory
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Mock fs.promises.writeFile to do nothing
      (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);

      // Call the save method
      await glossary.save();

      // Verify fs methods were called correctly
      expect(path.dirname).toHaveBeenCalledWith(testFilePath);
      expect(fs.existsSync).toHaveBeenCalledWith('/test');
      expect(fs.promises.writeFile).toHaveBeenCalledWith(testFilePath, expect.any(String), 'utf8');
    });

    test('should create directory if it does not exist', async () => {
      // Mock path.dirname to return directory path
      (path.dirname as jest.Mock).mockReturnValue('/test');

      // Mock fs.existsSync to return false for directory
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      // Mock fs.promises.mkdir to do nothing
      (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);

      // Mock fs.promises.writeFile to do nothing
      (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);

      // Call the save method
      await glossary.save();

      // Verify fs methods were called correctly
      expect(path.dirname).toHaveBeenCalledWith(testFilePath);
      expect(fs.existsSync).toHaveBeenCalledWith('/test');
      expect(fs.promises.mkdir).toHaveBeenCalledWith('/test', { recursive: true });
      expect(fs.promises.writeFile).toHaveBeenCalledWith(testFilePath, expect.any(String), 'utf8');
    });

    test('should handle errors when saving glossary', async () => {
      // Mock path.dirname to return directory path
      (path.dirname as jest.Mock).mockReturnValue('/test');

      // Mock fs.existsSync to return true for directory
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Mock fs.promises.writeFile to throw an error
      const testError = new Error('Test error');
      (fs.promises.writeFile as jest.Mock).mockRejectedValue(testError);

      // Call the save method and expect it to throw
      await expect(glossary.save()).rejects.toThrow(testError);

      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error saving glossary'));
    });
  });

  describe('addEntry', () => {
    test('should add new entry when term does not exist', () => {
      // Create a new entry
      const newEntry: IGlossaryEntry = {
        term: 'test',
        translations: { ja: 'テスト' },
      };

      // Add the entry
      glossary.addEntry(newEntry);

      // Verify entry was added
      expect(glossary.getAllEntries()).toContainEqual(newEntry);
    });

    test('should update existing entry when term exists', () => {
      // Add initial entries
      sampleEntries.forEach((entry) => glossary.addEntry(entry));

      // Create an updated entry
      const updatedEntry: IGlossaryEntry = {
        term: 'hello',
        translations: { de: 'hallo' },
        notes: 'Updated notes',
      };

      // Update the entry
      glossary.addEntry(updatedEntry);

      // Verify entry was updated correctly
      const entries = glossary.getAllEntries();
      const updatedEntryInGlossary = entries.find((e) => e.term === 'hello');

      expect(updatedEntryInGlossary).toBeDefined();
      expect(updatedEntryInGlossary?.translations).toEqual({
        ja: 'こんにちは',
        fr: 'bonjour',
        de: 'hallo',
      });
      expect(updatedEntryInGlossary?.context).toBe('greeting');
      expect(updatedEntryInGlossary?.notes).toBe('Updated notes');
    });

    test('should be case-insensitive when matching terms', () => {
      // Add initial entry
      glossary.addEntry(sampleEntries[0]);

      // Create an updated entry with different case
      const updatedEntry: IGlossaryEntry = {
        term: 'HELLO',
        translations: { de: 'hallo' },
      };

      // Update the entry
      glossary.addEntry(updatedEntry);

      // Verify entry was updated correctly
      const entries = glossary.getAllEntries();
      expect(entries.length).toBe(1);

      const updatedEntryInGlossary = entries[0];
      expect(updatedEntryInGlossary.translations).toEqual({
        ja: 'こんにちは',
        fr: 'bonjour',
        de: 'hallo',
      });
    });
  });

  describe('removeEntry', () => {
    test('should remove entry when term exists', () => {
      // Add initial entries
      sampleEntries.forEach((entry) => glossary.addEntry(entry));

      // Remove an entry
      const result = glossary.removeEntry('hello');

      // Verify entry was removed
      expect(result).toBe(true);
      expect(glossary.getAllEntries().length).toBe(1);
      expect(glossary.getAllEntries()[0].term).toBe('goodbye');
    });

    test('should return false when term does not exist', () => {
      // Add initial entries
      sampleEntries.forEach((entry) => glossary.addEntry(entry));

      // Try to remove a non-existent entry
      const result = glossary.removeEntry('nonexistent');

      // Verify no entry was removed
      expect(result).toBe(false);
      expect(glossary.getAllEntries().length).toBe(2);
    });

    test('should be case-insensitive when matching terms', () => {
      // Add initial entries
      sampleEntries.forEach((entry) => glossary.addEntry(entry));

      // Remove an entry with different case
      const result = glossary.removeEntry('HELLO');

      // Verify entry was removed
      expect(result).toBe(true);
      expect(glossary.getAllEntries().length).toBe(1);
      expect(glossary.getAllEntries()[0].term).toBe('goodbye');
    });
  });

  describe('getEntriesForLanguage', () => {
    test('should return entries for specified language', () => {
      // Add initial entries
      sampleEntries.forEach((entry) => glossary.addEntry(entry));

      // Get entries for Japanese
      const jaEntries = glossary.getEntriesForLanguage('ja');

      // Verify correct entries were returned
      expect(jaEntries).toEqual({
        hello: 'こんにちは',
        goodbye: 'さようなら',
      });
    });

    test('should return empty object when no entries exist for language', () => {
      // Add initial entries
      sampleEntries.forEach((entry) => glossary.addEntry(entry));

      // Get entries for a language with no translations
      const deEntries = glossary.getEntriesForLanguage('de');

      // Verify empty object was returned
      expect(deEntries).toEqual({});
    });
  });

  describe('searchEntries', () => {
    test('should find entries matching term in source', () => {
      // Add initial entries
      sampleEntries.forEach((entry) => glossary.addEntry(entry));

      // Search for entries
      const results = glossary.searchEntries('hello');

      // Verify correct entries were returned
      expect(results.length).toBe(1);
      expect(results[0].term).toBe('hello');
    });

    test('should find entries matching term in translations', () => {
      // Add initial entries
      sampleEntries.forEach((entry) => glossary.addEntry(entry));

      // Search for entries
      const results = glossary.searchEntries('こんにちは');

      // Verify correct entries were returned
      expect(results.length).toBe(1);
      expect(results[0].term).toBe('hello');
    });

    test('should be case-insensitive when searching', () => {
      // Add initial entries
      sampleEntries.forEach((entry) => glossary.addEntry(entry));

      // Search for entries with different case
      const results = glossary.searchEntries('HELLO');

      // Verify correct entries were returned
      expect(results.length).toBe(1);
      expect(results[0].term).toBe('hello');
    });

    test('should return empty array when no matches found', () => {
      // Add initial entries
      sampleEntries.forEach((entry) => glossary.addEntry(entry));

      // Search for non-existent term
      const results = glossary.searchEntries('nonexistent');

      // Verify empty array was returned
      expect(results).toEqual([]);
    });

    test('should match partial terms', () => {
      // Add initial entries
      sampleEntries.forEach((entry) => glossary.addEntry(entry));

      // Search for partial term
      const results = glossary.searchEntries('good');

      // Verify correct entries were returned
      expect(results.length).toBe(1);
      expect(results[0].term).toBe('goodbye');
    });
  });
});
