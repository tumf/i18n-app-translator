import * as fs from 'fs';
import * as path from 'path';
import type { IContextExtractorOptions } from '../../utils/contextExtractor';
import { ContextExtractor } from '../../utils/contextExtractor';
import logger from '../../utils/logger';
import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('path');
jest.mock('glob');
jest.mock('../../utils/logger');
jest.mock('fs');
jest.mock('util');

// Setup mocks after jest.mock calls
const mockGlob = jest.fn().mockReturnValue(Promise.resolve(['file1.ts', 'file2.ts']));
const mockReadFilePromise = jest.fn();
const mockPromisify = jest.fn().mockReturnValue(mockReadFilePromise);

// Mock fs.readFile
jest
  .spyOn(fs, 'readFile')
  .mockImplementation(
    (
      path: fs.PathOrFileDescriptor,
      options: any,
      callback?: (err: NodeJS.ErrnoException | null, data: Buffer) => void,
    ) => {
      if (typeof options === 'function') {
        callback = options;
        options = undefined;
      }
      if (callback) {
        if (String(path).includes('file1.ts')) {
          callback(null, Buffer.from('line1\nkey1\nline3\nline4\nkey2\nline6'));
        } else if (String(path).includes('file2.ts')) {
          callback(null, Buffer.from('line1\nline2\nkey1 in some context\nline4'));
        } else {
          callback(null, Buffer.from('mocked file content'));
        }
      }
      return undefined as any;
    },
  );

// Override the mocked modules
(jest.requireMock('glob') as any).glob = mockGlob;
(jest.requireMock('util') as any).promisify = mockPromisify;

describe('ContextExtractor', () => {
  // Setup mocks
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock path.join to return the file path
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
  });

  describe('constructor', () => {
    test('should initialize with default options', () => {
      const basePath = '/test/path';
      const extractor = new ContextExtractor(basePath);

      // @ts-expect-error - accessing private property for testing
      expect(extractor.basePath).toBe(basePath);
      // @ts-expect-error - accessing private property for testing
      expect(extractor.options.contextLines).toBe(2);
      // @ts-expect-error - accessing private property for testing
      expect(extractor.options.includePatterns).toEqual([
        '**/*.{txt,md,html,css,js,jsx,ts,tsx,json,xml,yaml,yml,vue,svelte,php,rb,py,java,c,cpp,cs,go}',
      ]);
      // @ts-expect-error - accessing private property for testing
      expect(extractor.options.excludePatterns).toEqual([
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/vendor/**',
      ]);
    });

    test('should initialize with custom options', () => {
      const basePath = '/test/path';
      const options: IContextExtractorOptions = {
        contextLines: 5,
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/node_modules/**'],
      };
      const extractor = new ContextExtractor(basePath, options);

      // @ts-expect-error - accessing private property for testing
      expect(extractor.basePath).toBe(basePath);
      // @ts-expect-error - accessing private property for testing
      expect(extractor.options.contextLines).toBe(5);
      // @ts-expect-error - accessing private property for testing
      expect(extractor.options.includePatterns).toEqual(['**/*.ts']);
      // @ts-expect-error - accessing private property for testing
      expect(extractor.options.excludePatterns).toEqual(['**/node_modules/**']);
    });
  });

  describe('extractContextForKeys', () => {
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();

      // Mock logger
      jest.spyOn(logger, 'info').mockImplementation(() => {});
      jest.spyOn(logger, 'warn').mockImplementation(() => {});
    });

    test('should extract context for keys found in files', async () => {
      // Mock readFile to return file content with keys
      const mockFileContent1 = 'line1\nkey1\nline3\nline4\nkey2\nline6';
      const mockFileContent2 = 'line1\nline2\nkey1 in some context\nline4';

      // Set up the mock to return different content based on file path
      mockReadFilePromise.mockImplementation((path) => {
        if (String(path).includes('file1.ts')) {
          return Promise.resolve(mockFileContent1);
        } else if (String(path).includes('file2.ts')) {
          return Promise.resolve(mockFileContent2);
        } else {
          return Promise.reject(new Error('File not found'));
        }
      });

      const basePath = '/test/path';
      const extractor = new ContextExtractor(basePath);
      const keys = ['key1', 'key2'];

      const result = await extractor.extractContextForKeys(keys);

      // Verify glob was called with the correct parameters
      const globMock = (jest.requireMock('glob') as any).glob as jest.Mock;
      expect(globMock).toHaveBeenCalledWith(
        [
          '**/*.{txt,md,html,css,js,jsx,ts,tsx,json,xml,yaml,yml,vue,svelte,php,rb,py,java,c,cpp,cs,go}',
        ],
        {
          cwd: basePath,
          ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/vendor/**'],
        },
      );

      // Verify readFile was called
      expect(fs.readFile).toHaveBeenCalled();

      // Verify the result contains the expected keys and contexts
      expect(result.size).toBe(2);

      const key1Context = result.get('key1');
      expect(key1Context).toBeDefined();
      expect(key1Context?.contexts.length).toBe(2);
      expect(key1Context?.contexts[0].file).toBe('file1.ts');
      expect(key1Context?.contexts[0].lineNumber).toBe(2);
      expect(key1Context?.contexts[0].context).toContain('key1');

      expect(key1Context?.contexts[1].file).toBe('file2.ts');
      expect(key1Context?.contexts[1].lineNumber).toBe(3);
      expect(key1Context?.contexts[1].context).toContain('key1 in some context');

      const key2Context = result.get('key2');
      expect(key2Context).toBeDefined();
      expect(key2Context?.contexts.length).toBe(1);
      expect(key2Context?.contexts[0].file).toBe('file1.ts');
      expect(key2Context?.contexts[0].lineNumber).toBe(5);
      expect(key2Context?.contexts[0].context).toContain('key2');

      // Verify logger.info was called
      expect(logger.info).toHaveBeenCalled();
    });

    test('should handle files with no matching keys', async () => {
      // Mock readFile to return file content with no keys
      const mockFileContent = 'line1\nline2\nline3\nline4';

      // Set up the mock to return content with no keys
      mockReadFilePromise.mockImplementation(() => {
        return Promise.resolve(mockFileContent);
      });

      const basePath = '/test/path';
      const extractor = new ContextExtractor(basePath);
      const keys = ['key1', 'key2'];

      const result = await extractor.extractContextForKeys(keys);

      // Verify the result contains the expected keys but no contexts
      expect(result.size).toBe(2);

      const key1Context = result.get('key1');
      expect(key1Context).toBeDefined();
      expect(key1Context?.contexts.length).toBe(0);

      const key2Context = result.get('key2');
      expect(key2Context).toBeDefined();
      expect(key2Context?.contexts.length).toBe(0);
    });

    test('should handle errors when reading files', async () => {
      // Set up the mock to throw an error
      mockReadFilePromise.mockImplementation(() => {
        return Promise.reject(new Error('Test error'));
      });

      const basePath = '/test/path';
      const extractor = new ContextExtractor(basePath);
      const keys = ['key1'];

      const result = await extractor.extractContextForKeys(keys);

      // Verify logger.warn was called
      expect(logger.warn).toHaveBeenCalled();

      // Verify the result contains the expected key but no contexts
      expect(result.size).toBe(1);

      const key1Context = result.get('key1');
      expect(key1Context).toBeDefined();
      expect(key1Context?.contexts.length).toBe(0);
    });

    test('should respect contextLines option', async () => {
      // Mock readFile to return file content with keys
      const mockFileContent = 'line1\nline2\nline3\nkey1\nline5\nline6\nline7';

      // Set up the mock to return content with keys
      mockReadFilePromise.mockImplementation(() => {
        return Promise.resolve(mockFileContent);
      });

      const basePath = '/test/path';
      const extractor = new ContextExtractor(basePath, { contextLines: 1 });
      const keys = ['key1'];

      const result = await extractor.extractContextForKeys(keys);

      // Verify the context includes only 1 line before and after the key
      const key1Context = result.get('key1');
      expect(key1Context).toBeDefined();
      expect(key1Context?.contexts.length).toBe(2);
      expect(key1Context?.contexts[0].context).toContain('key1');
    });

    test('should handle keys at the beginning of the file', async () => {
      // Mock readFile to return file content with key at the beginning
      const mockFileContent = 'key1\nline2\nline3';

      // Set up the mock to return content with key at the beginning
      mockReadFilePromise.mockImplementation(() => {
        return Promise.resolve(mockFileContent);
      });

      const basePath = '/test/path';
      const extractor = new ContextExtractor(basePath);
      const keys = ['key1'];

      const result = await extractor.extractContextForKeys(keys);

      // Verify the context handles the key at the beginning of the file
      const key1Context = result.get('key1');
      expect(key1Context).toBeDefined();
      expect(key1Context?.contexts.length).toBe(2);
      expect(key1Context?.contexts[0].context).toContain('key1');
    });

    test('should handle keys at the end of the file', async () => {
      // Mock readFile to return file content with key at the end
      const mockFileContent = 'line1\nline2\nkey1';

      // Set up the mock to return content with key at the end
      mockReadFilePromise.mockImplementation(() => {
        return Promise.resolve(mockFileContent);
      });

      const basePath = '/test/path';
      const extractor = new ContextExtractor(basePath);
      const keys = ['key1'];

      const result = await extractor.extractContextForKeys(keys);

      // Verify the context handles the key at the end of the file
      const key1Context = result.get('key1');
      expect(key1Context).toBeDefined();
      expect(key1Context?.contexts.length).toBe(2);
      expect(key1Context?.contexts[0].context).toContain('key1');
    });

    test('should handle keys with special regex characters', async () => {
      // Mock readFile to return file content with key containing special regex characters
      const mockFileContent = 'line1\nkey1.with.dots\nline3';

      // Set up the mock to return content with key containing special regex characters
      mockReadFilePromise.mockImplementation(() => {
        return Promise.resolve(mockFileContent);
      });

      const basePath = '/test/path';
      const extractor = new ContextExtractor(basePath);
      const keys = ['key1.with.dots'];

      const result = await extractor.extractContextForKeys(keys);

      // Verify the context handles the key with special regex characters
      const key1Context = result.get('key1.with.dots');
      expect(key1Context).toBeDefined();
      expect(key1Context?.contexts.length).toBe(2);
      expect(key1Context?.contexts[0].context).toContain('key1.with.dots');
    });
  });

  describe('formatContextString', () => {
    test('should format context information into a string', () => {
      const basePath = '/test/path';
      const extractor = new ContextExtractor(basePath);

      const keyContexts = new Map();
      keyContexts.set('key1', {
        key: 'key1',
        contexts: [
          {
            file: 'file1.ts',
            lineNumber: 2,
            context: 'line1\nkey1\nline3',
          },
          {
            file: 'file2.ts',
            lineNumber: 3,
            context: 'line2\nkey1 in some context\nline4',
          },
        ],
      });
      keyContexts.set('key2', {
        key: 'key2',
        contexts: [
          {
            file: 'file1.ts',
            lineNumber: 5,
            context: 'line4\nkey2\nline6',
          },
        ],
      });
      keyContexts.set('key3', {
        key: 'key3',
        contexts: [],
      });

      const result = extractor.formatContextString(keyContexts);

      // Verify the result contains the expected formatted string
      expect(result).toContain('Key "key1" is used in:');
      expect(result).toContain('- file1.ts:2');
      expect(result).toContain('  line1\n  key1\n  line3');
      expect(result).toContain('- file2.ts:3');
      expect(result).toContain('  line2\n  key1 in some context\n  line4');

      expect(result).toContain('Key "key2" is used in:');
      expect(result).toContain('- file1.ts:5');
      expect(result).toContain('  line4\n  key2\n  line6');

      expect(result).toContain('Key "key3" - no usage context found');
    });

    test('should limit the number of contexts per key', () => {
      const basePath = '/test/path';
      const extractor = new ContextExtractor(basePath);

      const keyContexts = new Map();
      keyContexts.set('key1', {
        key: 'key1',
        contexts: [
          {
            file: 'file1.ts',
            lineNumber: 2,
            context: 'line1\nkey1\nline3',
          },
          {
            file: 'file2.ts',
            lineNumber: 3,
            context: 'line2\nkey1 in some context\nline4',
          },
          {
            file: 'file3.ts',
            lineNumber: 4,
            context: 'line3\nkey1 in another context\nline5',
          },
          {
            file: 'file4.ts',
            lineNumber: 5,
            context: 'line4\nkey1 in yet another context\nline6',
          },
        ],
      });

      // Default maxContextsPerKey is 3
      const result = extractor.formatContextString(keyContexts);

      // Verify only the first 3 contexts are included
      expect(result).toContain('- file1.ts:2');
      expect(result).toContain('- file2.ts:3');
      expect(result).toContain('- file3.ts:4');
      expect(result).not.toContain('- file4.ts:5');

      // Test with custom maxContextsPerKey
      const resultWithCustomMax = extractor.formatContextString(keyContexts, 2);

      // Verify only the first 2 contexts are included
      expect(resultWithCustomMax).toContain('- file1.ts:2');
      expect(resultWithCustomMax).toContain('- file2.ts:3');
      expect(resultWithCustomMax).not.toContain('- file3.ts:4');
      expect(resultWithCustomMax).not.toContain('- file4.ts:5');
    });
  });
});
