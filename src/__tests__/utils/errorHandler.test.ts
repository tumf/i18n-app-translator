import * as fs from 'fs';

// Mock chalk module
jest.mock('chalk', () => ({
  blue: (text: string) => `[INFO] ${text}`,
  yellow: (text: string) => `[WARN] ${text}`,
  red: (text: string) => `[ERROR] ${text}`,
  gray: (text: string) => text,
  bgRed: {
    white: (text: string) => `[FATAL] ${text}`,
  },
}));

import {
  AppError,
  ErrorLevel,
  handleError,
  validateRequiredParams,
  validateFileExists,
  validateFileFormat,
  validateEnvironmentVars,
} from '../../utils/errorHandler';

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

describe('errorHandler', () => {
  let consoleOutput: { log: string[]; warn: string[]; error: string[] };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup console mocks
    consoleOutput = { log: [], warn: [], error: [] };
    console.log = jest.fn((...args) => {
      consoleOutput.log.push(args.join(' '));
    });
    console.warn = jest.fn((...args) => {
      consoleOutput.warn.push(args.join(' '));
    });
    console.error = jest.fn((...args) => {
      consoleOutput.error.push(args.join(' '));
    });
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });

  describe('AppError', () => {
    it('should create an error with default options', () => {
      const error = new AppError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.name).toBe('AppError');
      expect(error.level).toBe(ErrorLevel.ERROR);
      expect(error.exit).toBe(false);
      expect(error.code).toBe(1);
      expect(error.details).toBeUndefined();
    });

    it('should create an error with custom options', () => {
      const error = new AppError('Test error', {
        level: ErrorLevel.FATAL,
        exit: true,
        code: 2,
        details: { test: 'details' },
      });

      expect(error.message).toBe('Test error');
      expect(error.level).toBe(ErrorLevel.FATAL);
      expect(error.exit).toBe(true);
      expect(error.code).toBe(2);
      expect(error.details).toEqual({ test: 'details' });
    });

    it('should set exit to true for FATAL errors by default', () => {
      const error = new AppError('Fatal error', { level: ErrorLevel.FATAL });
      expect(error.exit).toBe(true);
    });
  });

  describe('handleError', () => {
    it('should handle INFO level AppError', () => {
      const error = new AppError('Info message', { level: ErrorLevel.INFO });
      handleError(error);

      expect(consoleOutput.log.length).toBe(1);
      expect(consoleOutput.log[0]).toContain('Info message');
      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should handle WARNING level AppError', () => {
      const error = new AppError('Warning message', { level: ErrorLevel.WARNING });
      handleError(error);

      expect(consoleOutput.warn.length).toBe(1);
      expect(consoleOutput.warn[0]).toContain('Warning message');
      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should handle ERROR level AppError', () => {
      const error = new AppError('Error message', { level: ErrorLevel.ERROR });
      handleError(error);

      expect(consoleOutput.error.length).toBe(1);
      expect(consoleOutput.error[0]).toContain('Error message');
      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should handle FATAL level AppError', () => {
      const error = new AppError('Fatal message', { level: ErrorLevel.FATAL, exit: false });
      handleError(error);

      expect(consoleOutput.error.length).toBe(1);
      expect(consoleOutput.error[0]).toContain('FATAL');
      expect(consoleOutput.error[0]).toContain('Fatal message');
      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should display error details when provided', () => {
      const error = new AppError('Error with details', {
        details: { test: 'details' },
      });
      handleError(error);

      expect(consoleOutput.error.length).toBe(1);
      expect(consoleOutput.log.length).toBe(2);
      expect(console.log).toHaveBeenCalledWith(expect.any(String));
      expect(console.log).toHaveBeenCalledWith(expect.any(String));
    });

    it('should handle standard Error objects', () => {
      const error = new Error('Standard error');
      handleError(error);

      expect(consoleOutput.error.length).toBeGreaterThanOrEqual(1);
      expect(consoleOutput.error[0]).toContain('Unexpected error');
      expect(consoleOutput.error[0]).toContain('Standard error');
    });

    it('should handle unknown errors', () => {
      handleError('String error');

      expect(consoleOutput.error.length).toBeGreaterThanOrEqual(1);
      expect(consoleOutput.error[0]).toContain('Unknown error occurred');
      expect(consoleOutput.error[1]).toContain('String error');
    });
  });

  describe('validateRequiredParams', () => {
    it('should not throw when all required params are present', () => {
      const params = { a: 1, b: 'test', c: true };
      expect(() => validateRequiredParams(params, ['a', 'b', 'c'])).not.toThrow();
    });

    it('should throw AppError when required params are missing', () => {
      const params = { a: 1, c: true };
      expect(() => validateRequiredParams(params, ['a', 'b', 'c'])).toThrow(AppError);
      expect(() => validateRequiredParams(params, ['a', 'b', 'c'])).toThrow(
        'Missing required parameters: b',
      );
    });

    it('should list all missing params in the error message', () => {
      const params = { a: 1 };
      expect(() => validateRequiredParams(params, ['a', 'b', 'c'])).toThrow(
        'Missing required parameters: b, c',
      );
    });
  });

  describe('validateFileExists', () => {
    it('should not throw when file exists', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      expect(() => validateFileExists('/path/to/file.json', 'JSON')).not.toThrow();
    });

    it('should throw AppError when file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      expect(() => validateFileExists('/path/to/file.json', 'JSON')).toThrow(AppError);
      expect(() => validateFileExists('/path/to/file.json', 'JSON')).toThrow(
        'JSON file not found: /path/to/file.json',
      );
    });
  });

  describe('validateFileFormat', () => {
    it('should not throw when file has the expected format', () => {
      expect(() => validateFileFormat('/path/to/file.json', 'json')).not.toThrow();
    });

    it('should not throw when file has the expected format with different case', () => {
      expect(() => validateFileFormat('/path/to/file.JSON', 'json')).not.toThrow();
      expect(() => validateFileFormat('/path/to/file.json', 'JSON')).not.toThrow();
    });

    it('should throw AppError when file has an unexpected format', () => {
      expect(() => validateFileFormat('/path/to/file.txt', 'json')).toThrow(AppError);
      expect(() => validateFileFormat('/path/to/file.txt', 'json')).toThrow(
        'Invalid file format. Expected .json but got .txt',
      );
    });
  });

  describe('validateEnvironmentVars', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should not throw when all required env vars are present', () => {
      process.env.TEST_VAR1 = 'value1';
      process.env.TEST_VAR2 = 'value2';

      expect(() => validateEnvironmentVars(['TEST_VAR1', 'TEST_VAR2'])).not.toThrow();
    });

    it('should throw AppError when required env vars are missing', () => {
      process.env.TEST_VAR1 = 'value1';
      delete process.env.TEST_VAR2;

      expect(() => validateEnvironmentVars(['TEST_VAR1', 'TEST_VAR2'])).toThrow(AppError);
      expect(() => validateEnvironmentVars(['TEST_VAR1', 'TEST_VAR2'])).toThrow(
        'Missing required environment variables: TEST_VAR2',
      );
    });

    it('should list all missing env vars in the error message', () => {
      delete process.env.TEST_VAR1;
      delete process.env.TEST_VAR2;

      expect(() => validateEnvironmentVars(['TEST_VAR1', 'TEST_VAR2'])).toThrow(
        'Missing required environment variables: TEST_VAR1, TEST_VAR2',
      );
    });
  });
});
