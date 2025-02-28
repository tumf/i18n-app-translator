import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Mock chalk before importing errorHandler
jest.mock('chalk', () => ({
  blue: jest.fn((text) => `[INFO] ${text}`),
  yellow: jest.fn((text) => `[WARN] ${text}`),
  red: jest.fn((text) => `[ERROR] ${text}`),
  gray: jest.fn((text) => text),
  bgRed: {
    white: jest.fn((text) => `[FATAL] ${text}`),
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
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock fs and path
jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));
jest.mock('path', () => ({
  extname: jest.fn(),
  join: jest.fn(),
}));

describe('AppError', () => {
  test('should create an error with default options', () => {
    const error = new AppError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('AppError');
    expect(error.level).toBe(ErrorLevel.ERROR);
    expect(error.exit).toBe(false);
    expect(error.code).toBe(1);
    expect(error.details).toBeUndefined();
  });

  test('should create an error with custom options', () => {
    const error = new AppError('Test error', {
      level: ErrorLevel.WARNING,
      exit: true,
      code: 2,
      details: { test: 'details' },
    });
    expect(error.message).toBe('Test error');
    expect(error.level).toBe(ErrorLevel.WARNING);
    expect(error.exit).toBe(true);
    expect(error.code).toBe(2);
    expect(error.details).toEqual({ test: 'details' });
  });

  test('should set exit to true for FATAL errors', () => {
    const error = new AppError('Fatal error', { level: ErrorLevel.FATAL });
    expect(error.exit).toBe(true);
  });
});

describe('handleError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle AppError with INFO level', () => {
    const error = new AppError('Info message', { level: ErrorLevel.INFO });
    handleError(error);
    expect(console.log).toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test('should handle AppError with WARNING level', () => {
    const error = new AppError('Warning message', { level: ErrorLevel.WARNING });
    handleError(error);
    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test('should handle AppError with ERROR level', () => {
    const error = new AppError('Error message', { level: ErrorLevel.ERROR });
    handleError(error);
    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  test('should handle AppError with FATAL level', () => {
    const error = new AppError('Fatal message', { level: ErrorLevel.FATAL, exit: false });
    handleError(error);
    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  test('should handle AppError with details', () => {
    const error = new AppError('Error with details', {
      level: ErrorLevel.ERROR,
      details: { test: 'details' },
    });
    handleError(error);
    expect(console.error).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.any(String));
    expect(console.log).toHaveBeenCalledWith(expect.any(String));
  });

  test('should handle standard Error', () => {
    // Mock process.exit for this test only
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    const error = new Error('Standard error');
    handleError(error);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Standard error'));

    // Restore original mock
    exitSpy.mockRestore();
  });

  test('should handle unknown error', () => {
    // Mock process.exit for this test only
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    handleError('Unknown error');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Unknown error'));

    // Restore original mock
    exitSpy.mockRestore();
  });
});

describe('validateRequiredParams', () => {
  test('should not throw error when all required params are present', () => {
    const params = { param1: 'value1', param2: 'value2' };
    const requiredParams = ['param1', 'param2'];
    expect(() => validateRequiredParams(params, requiredParams)).not.toThrow();
  });

  test('should throw AppError when required params are missing', () => {
    const params = { param1: 'value1' };
    const requiredParams = ['param1', 'param2'];
    expect(() => validateRequiredParams(params, requiredParams)).toThrow(AppError);
    expect(() => validateRequiredParams(params, requiredParams)).toThrow(
      'Missing required parameters: param2',
    );
  });
});

describe('validateFileExists', () => {
  test('should not throw error when file exists', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    expect(() => validateFileExists('/path/to/file', 'Test')).not.toThrow();
  });

  test('should throw AppError when file does not exist', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    expect(() => validateFileExists('/path/to/file', 'Test')).toThrow(AppError);
    expect(() => validateFileExists('/path/to/file', 'Test')).toThrow(
      'Test file not found: /path/to/file',
    );
  });
});

describe('validateFileFormat', () => {
  test('should not throw error when file format matches expected', () => {
    (path.extname as jest.Mock).mockReturnValue('.json');
    expect(() => validateFileFormat('/path/to/file.json', 'json')).not.toThrow();
  });

  test('should throw AppError when file format does not match expected', () => {
    (path.extname as jest.Mock).mockReturnValue('.txt');
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

  test('should not throw error when all required vars are present', () => {
    process.env.VAR1 = 'value1';
    process.env.VAR2 = 'value2';
    const requiredVars = ['VAR1', 'VAR2'];
    expect(() => validateEnvironmentVars(requiredVars)).not.toThrow();
  });

  test('should throw AppError when required vars are missing', () => {
    process.env.VAR1 = 'value1';
    delete process.env.VAR2;
    const requiredVars = ['VAR1', 'VAR2'];
    expect(() => validateEnvironmentVars(requiredVars)).toThrow(AppError);
    expect(() => validateEnvironmentVars(requiredVars)).toThrow(
      'Missing required environment variables: VAR2',
    );
  });
});
