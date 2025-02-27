import * as path from 'path';
import { ContextExtractor } from '../../utils/contextExtractor';
import logger from '../../utils/logger';
import { jest } from '@jest/globals';

// Mock modules - use auto mocking
jest.mock('path');
jest.mock('glob', () => ({
  glob: jest.fn().mockImplementation(() => Promise.resolve(['file1.ts', 'file2.ts'])),
}));
jest.mock('util', () => ({
  promisify: jest.fn().mockImplementation(() => {
    return jest.fn().mockImplementation((filePath) => {
      if (String(filePath).includes('file1.ts')) {
        return Promise.resolve('line1\nkey1\nline3\nline4\nkey2\nline6');
      } else if (String(filePath).includes('file2.ts')) {
        return Promise.resolve('line1\nline2\nkey1 in some context\nline4');
      }
      return Promise.resolve('default content');
    });
  }),
}));
jest.mock('../../utils/logger');

describe('ContextExtractor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
    (logger.info as jest.Mock).mockImplementation(() => {});
    (logger.warn as jest.Mock).mockImplementation(() => {});
  });

  describe('constructor', () => {
    test('should initialize with default options', () => {
      const basePath = '/test/path';
      const extractor = new ContextExtractor(basePath);

      // @ts-expect-error - accessing private property for testing
      expect(extractor.basePath).toBe(basePath);
      // @ts-expect-error - accessing private property for testing
      expect(extractor.options.contextLines).toBe(2);
    });

    test('should initialize with custom options', () => {
      const basePath = '/test/path';
      const options = {
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
    test('should extract context for keys found in files', async () => {
      const basePath = '/test/path';
      const extractor = new ContextExtractor(basePath);
      const keys = ['key1', 'key2'];

      const result = await extractor.extractContextForKeys(keys);

      // Verify result has keys and contexts
      expect(result.size).toBe(2);
      const key1Context = result.get('key1');
      expect(key1Context).toBeDefined();
      expect(key1Context?.contexts.length).toBe(2);
    });
  });

  describe('formatContextString', () => {
    test('should format context information into a string', () => {
      const keyContexts = new Map();
      keyContexts.set('key1', {
        key: 'key1',
        contexts: [{ file: 'file1.ts', lineNumber: 2, context: 'context for key1' }],
      });

      const basePath = '/test/path';
      const extractor = new ContextExtractor(basePath);
      const result = extractor.formatContextString(keyContexts);

      expect(result).toContain('Key "key1" is used in:');
      expect(result).toContain('file1.ts:2');
    });

    test('should limit the number of contexts per key', () => {
      const keyContexts = new Map();
      keyContexts.set('key1', {
        key: 'key1',
        contexts: [
          { file: 'file1.ts', lineNumber: 2, context: 'context for key1' },
          { file: 'file2.ts', lineNumber: 3, context: 'key1 in file2' },
          { file: 'file3.ts', lineNumber: 4, context: 'key1 in file3' },
          { file: 'file4.ts', lineNumber: 5, context: 'key1 in file4' },
        ],
      });

      const basePath = '/test/path';
      const extractor = new ContextExtractor(basePath);
      const result = extractor.formatContextString(keyContexts, 2);

      expect(result).toContain('Key "key1" is used in:');
      expect(result).toContain('file1.ts:2');
      expect(result).toContain('file2.ts:3');
      expect(result).not.toContain('file3.ts:4');
      expect(result).not.toContain('file4.ts:5');
    });
  });
});
