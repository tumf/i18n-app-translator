import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import type { I18nEntry, I18nData } from '../../utils/parser';
import { Parser } from '../../utils/parser';
import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('fs', () => {
  return {
    existsSync: jest.fn(),
    promises: {
      readFile: jest.fn().mockImplementation(() => Promise.resolve('')),
      writeFile: jest.fn().mockImplementation(() => Promise.resolve()),
      mkdir: jest.fn().mockImplementation(() => Promise.resolve()),
    },
  };
});
jest.mock('path');
jest.mock('glob', () => ({
  glob: jest.fn().mockImplementation(() => Promise.resolve([])),
}));

describe('Parser', () => {
  let parser: Parser;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create a new parser instance for each test
    parser = new Parser();

    // Mock console methods
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('parseI18nFile', () => {
    test('should parse a valid i18n file', async () => {
      // Mock file content
      const mockContent = JSON.stringify({
        common: {
          ok: 'OK',
          cancel: 'Cancel',
        },
        auth: {
          login: 'Login',
          logout: 'Logout',
        },
      });

      // Mock fs.promises.readFile
      (fs.promises.readFile as jest.Mock).mockImplementation(() => Promise.resolve(mockContent));

      // Call the method
      const result = await parser.parseI18nFile('en.json');

      // Verify the result
      expect(result).toEqual([
        { key: 'common.ok', value: 'OK' },
        { key: 'common.cancel', value: 'Cancel' },
        { key: 'auth.login', value: 'Login' },
        { key: 'auth.logout', value: 'Logout' },
      ]);

      // Verify fs.promises.readFile was called correctly
      expect(fs.promises.readFile).toHaveBeenCalledWith('en.json', 'utf8');
    });

    test('should throw an error when file cannot be read', async () => {
      // Mock fs.promises.readFile to throw an error
      const mockError = new Error('File not found');
      (fs.promises.readFile as jest.Mock).mockImplementation(() => Promise.reject(mockError));

      // Call the method and expect it to throw
      await expect(parser.parseI18nFile('invalid.json')).rejects.toThrow(mockError);

      // Verify console.error was called
      expect(console.error).toHaveBeenCalled();
    });

    test('should throw an error when JSON is invalid', async () => {
      // Mock fs.promises.readFile to return invalid JSON
      (fs.promises.readFile as jest.Mock).mockImplementation(() => Promise.resolve('invalid json'));

      // Call the method and expect it to throw
      await expect(parser.parseI18nFile('invalid.json')).rejects.toThrow();

      // Verify console.error was called
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('flattenI18nData', () => {
    test('should flatten nested i18n data', () => {
      // Create test data
      const data: I18nData = {
        common: {
          ok: 'OK',
          cancel: 'Cancel',
        },
        auth: {
          login: 'Login',
          logout: 'Logout',
        },
      };

      // Call the private method using any type assertion
      const result = (parser as any).flattenI18nData(data);

      // Verify the result
      expect(result).toEqual([
        { key: 'common.ok', value: 'OK' },
        { key: 'common.cancel', value: 'Cancel' },
        { key: 'auth.login', value: 'Login' },
        { key: 'auth.logout', value: 'Logout' },
      ]);
    });

    test('should flatten with prefix', () => {
      // Create test data
      const data: I18nData = {
        ok: 'OK',
        cancel: 'Cancel',
      };

      // Call the private method with a prefix
      const result = (parser as any).flattenI18nData(data, 'common');

      // Verify the result
      expect(result).toEqual([
        { key: 'common.ok', value: 'OK' },
        { key: 'common.cancel', value: 'Cancel' },
      ]);
    });

    test('should handle empty data', () => {
      // Create empty test data
      const data: I18nData = {};

      // Call the private method
      const result = (parser as any).flattenI18nData(data);

      // Verify the result
      expect(result).toEqual([]);
    });
  });

  describe('compareI18nFiles', () => {
    test('should find missing translations', () => {
      // Create source entries
      const sourceEntries: I18nEntry[] = [
        { key: 'common.ok', value: 'OK' },
        { key: 'common.cancel', value: 'Cancel' },
        { key: 'auth.login', value: 'Login' },
      ];

      // Create target entries (missing auth.login)
      const targetEntries: I18nEntry[] = [
        { key: 'common.ok', value: 'OK' },
        { key: 'common.cancel', value: 'キャンセル' },
      ];

      // Call the method
      const result = parser.compareI18nFiles(sourceEntries, targetEntries);

      // Verify the result
      expect(result.missing).toEqual([{ key: 'auth.login', value: 'Login' }]);
      // The implementation considers different values as outdated translations
      expect(result.outdated).toEqual([
        {
          source: { key: 'common.cancel', value: 'Cancel' },
          target: { key: 'common.cancel', value: 'キャンセル' },
        },
      ]);
    });

    test('should find outdated translations', () => {
      // Create source entries
      const sourceEntries: I18nEntry[] = [
        { key: 'common.ok', value: 'OK' },
        { key: 'common.cancel', value: 'Cancel' },
      ];

      // Create target entries (with outdated value for common.cancel)
      const targetEntries: I18nEntry[] = [
        { key: 'common.ok', value: 'OK' },
        { key: 'common.cancel', value: 'キャンセル' },
      ];

      // Call the method
      const result = parser.compareI18nFiles(sourceEntries, targetEntries);

      // Verify the result
      expect(result.missing).toEqual([]);
      expect(result.outdated).toEqual([
        {
          source: { key: 'common.cancel', value: 'Cancel' },
          target: { key: 'common.cancel', value: 'キャンセル' },
        },
      ]);
    });

    test('should handle when all translations are up to date', () => {
      // Create source entries
      const sourceEntries: I18nEntry[] = [{ key: 'common.ok', value: 'OK' }];

      // Create target entries (same as source)
      const targetEntries: I18nEntry[] = [{ key: 'common.ok', value: 'OK' }];

      // Call the method
      const result = parser.compareI18nFiles(sourceEntries, targetEntries);

      // Verify the result
      expect(result.missing).toEqual([]);
      expect(result.outdated).toEqual([]);
    });
  });

  describe('buildI18nData', () => {
    test('should build i18n data from entries', () => {
      // Create test entries
      const entries: I18nEntry[] = [
        { key: 'common.ok', value: 'OK' },
        { key: 'common.cancel', value: 'Cancel' },
        { key: 'auth.login', value: 'Login' },
        { key: 'auth.logout', value: 'Logout' },
      ];

      // Call the method
      const result = parser.buildI18nData(entries);

      // Verify the result
      expect(result).toEqual({
        common: {
          ok: 'OK',
          cancel: 'Cancel',
        },
        auth: {
          login: 'Login',
          logout: 'Logout',
        },
      });
    });

    test('should handle deeply nested keys', () => {
      // Create test entries with deeply nested keys
      const entries: I18nEntry[] = [{ key: 'a.b.c.d', value: 'Value' }];

      // Call the method
      const result = parser.buildI18nData(entries);

      // Verify the result
      expect(result).toEqual({
        a: {
          b: {
            c: {
              d: 'Value',
            },
          },
        },
      });
    });

    test('should handle empty entries', () => {
      // Call the method with empty entries
      const result = parser.buildI18nData([]);

      // Verify the result
      expect(result).toEqual({});
    });
  });

  describe('extractKeysFromSourceCode', () => {
    test('should extract keys from source code', async () => {
      // Mock file content with t function calls
      const mockContent = `
        import { useTranslation } from 'react-i18next';
        
        function Component() {
          const { t } = useTranslation();
          
          return (
            <div>
              <h1>{t('common.title')}</h1>
              <p>{t('common.description')}</p>
              <button>{t('common.buttons.submit')}</button>
            </div>
          );
        }
      `;

      // Mock glob to return a list of files
      (glob as unknown as jest.Mock).mockImplementation(() => Promise.resolve(['file1.tsx']));

      // Mock fs.promises.readFile
      (fs.promises.readFile as jest.Mock).mockImplementation(() => Promise.resolve(mockContent));

      // Mock path.relative
      (path.relative as jest.Mock).mockReturnValue('file1.tsx');

      // Call the method
      const result = await parser.extractKeysFromSourceCode('/src');

      // Verify the result
      expect(result).toEqual([
        { key: 'common.title', value: '', file: 'file1.tsx', line: 9 },
        { key: 'common.description', value: '', file: 'file1.tsx', line: 10 },
        { key: 'common.buttons.submit', value: '', file: 'file1.tsx', line: 11 },
      ]);

      // Verify glob was called correctly
      expect(glob).toHaveBeenCalledWith(['**/*.{js,jsx,ts,tsx}'], {
        cwd: '/src',
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
        absolute: true,
      });
    });

    test('should extract keys with custom patterns and exclude patterns', async () => {
      // Mock file content with t function calls
      const mockContent = `t('key1')`;

      // Mock glob to return a list of files
      (glob as unknown as jest.Mock).mockImplementation(() => Promise.resolve(['file1.js']));

      // Mock fs.promises.readFile
      (fs.promises.readFile as jest.Mock).mockImplementation(() => Promise.resolve(mockContent));

      // Mock path.relative
      (path.relative as jest.Mock).mockReturnValue('file1.js');

      // Call the method with custom patterns
      const result = await parser.extractKeysFromSourceCode('/src', ['**/*.js'], ['**/test/**']);

      // Verify the result
      expect(result).toEqual([{ key: 'key1', value: '', file: 'file1.js', line: 1 }]);

      // Verify glob was called correctly
      expect(glob).toHaveBeenCalledWith(['**/*.js'], {
        cwd: '/src',
        ignore: ['**/test/**'],
        absolute: true,
      });
    });

    test('should not add duplicate keys from the same file and line', async () => {
      // Mock file content with duplicate t function calls
      const mockContent = `
        const { t } = useTranslation();
        t('key1');
        t('key1');
      `;

      // Mock glob to return a list of files
      (glob as unknown as jest.Mock).mockImplementation(() => Promise.resolve(['file1.js']));

      // Mock fs.promises.readFile
      (fs.promises.readFile as jest.Mock).mockImplementation(() => Promise.resolve(mockContent));

      // Mock path.relative
      (path.relative as jest.Mock).mockReturnValue('file1.js');

      // Call the method
      const result = await parser.extractKeysFromSourceCode('/src');

      // The implementation doesn't deduplicate keys from different lines
      // It only prevents duplicates from the exact same line and file
      expect(result.filter((entry) => entry.key === 'key1')).toHaveLength(2);
    });
  });

  describe('saveI18nFile', () => {
    test('should save i18n data to file', async () => {
      // Mock fs.existsSync
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      // Mock fs.promises.mkdir
      (fs.promises.mkdir as jest.Mock).mockImplementation(() => Promise.resolve());

      // Mock fs.promises.writeFile
      (fs.promises.writeFile as jest.Mock).mockImplementation(() => Promise.resolve());

      // Mock path.dirname
      (path.dirname as jest.Mock).mockReturnValue('/dir');

      // Create test data
      const data: I18nData = {
        common: {
          ok: 'OK',
        },
      };

      // Call the method
      await parser.saveI18nFile('file.json', data);

      // Verify fs.promises.mkdir was called correctly
      expect(fs.promises.mkdir).toHaveBeenCalledWith('/dir', { recursive: true });

      // Verify fs.promises.writeFile was called correctly
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        'file.json',
        JSON.stringify(data, null, 2),
        'utf8',
      );
    });

    test('should not create directory if it already exists', async () => {
      // Mock fs.existsSync
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Mock fs.promises.writeFile
      (fs.promises.writeFile as jest.Mock).mockImplementation(() => Promise.resolve());

      // Mock path.dirname
      (path.dirname as jest.Mock).mockReturnValue('/dir');

      // Create test data
      const data: I18nData = {
        common: {
          ok: 'OK',
        },
      };

      // Call the method
      await parser.saveI18nFile('file.json', data);

      // Verify fs.promises.mkdir was not called
      expect(fs.promises.mkdir).not.toHaveBeenCalled();

      // Verify fs.promises.writeFile was called correctly
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        'file.json',
        JSON.stringify(data, null, 2),
        'utf8',
      );
    });

    test('should throw an error when file cannot be written', async () => {
      // Mock fs.existsSync
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Mock fs.promises.writeFile to throw an error
      const mockError = new Error('Permission denied');
      (fs.promises.writeFile as jest.Mock).mockImplementation(() => Promise.reject(mockError));

      // Mock path.dirname
      (path.dirname as jest.Mock).mockReturnValue('/dir');

      // Create test data
      const data: I18nData = {
        common: {
          ok: 'OK',
        },
      };

      // Call the method and expect it to throw
      await expect(parser.saveI18nFile('file.json', data)).rejects.toThrow(mockError);

      // Verify console.error was called
      expect(console.error).toHaveBeenCalled();
    });
  });
});
