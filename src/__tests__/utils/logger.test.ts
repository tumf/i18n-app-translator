import fs from 'fs';
import path from 'path';
import { Logger, LogLevel } from '../../utils/logger';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn(),
}));

// Mock console.log and console.error
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('Logger', () => {
  const testLogFilePath = '/test/path/to/log.log';

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    // Restore console functions
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('constructor', () => {
    it('should use default options when none provided', () => {
      const logger = new Logger();
      expect(logger['level']).toBe(LogLevel.INFO);
      expect(logger['logToFile']).toBe(false);
      expect(logger['logToConsole']).toBe(true);
      expect(logger['timestamp']).toBe(true);
      expect(logger['logFilePath']).toContain('i18n-app-translator.log');
    });

    it('should use provided options', () => {
      const logger = new Logger({
        level: LogLevel.DEBUG,
        logToFile: true,
        logFilePath: testLogFilePath,
        logToConsole: false,
        timestamp: false,
      });

      expect(logger['level']).toBe(LogLevel.DEBUG);
      expect(logger['logToFile']).toBe(true);
      expect(logger['logFilePath']).toBe(testLogFilePath);
      expect(logger['logToConsole']).toBe(false);
      expect(logger['timestamp']).toBe(false);
    });

    it('should create log directory if it does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      new Logger({
        logToFile: true,
        logFilePath: testLogFilePath,
      });

      expect(fs.existsSync).toHaveBeenCalledWith(path.dirname(testLogFilePath));
      expect(fs.mkdirSync).toHaveBeenCalledWith(path.dirname(testLogFilePath), { recursive: true });
    });

    it('should not create log directory if it already exists', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      new Logger({
        logToFile: true,
        logFilePath: testLogFilePath,
      });

      expect(fs.existsSync).toHaveBeenCalledWith(path.dirname(testLogFilePath));
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('logging methods', () => {
    it('should log debug messages when level is DEBUG', () => {
      const logger = new Logger({ level: LogLevel.DEBUG });
      logger.debug('Test debug message');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG: Test debug message'),
      );
    });

    it('should not log debug messages when level is INFO', () => {
      const logger = new Logger({ level: LogLevel.INFO });
      logger.debug('Test debug message');

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should log info messages when level is INFO', () => {
      const logger = new Logger({ level: LogLevel.INFO });
      logger.info('Test info message');

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('INFO: Test info message'));
    });

    it('should not log info messages when level is WARN', () => {
      const logger = new Logger({ level: LogLevel.WARN });
      logger.info('Test info message');

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should log warn messages when level is WARN', () => {
      const logger = new Logger({ level: LogLevel.WARN });
      logger.warn('Test warn message');

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('WARN: Test warn message'));
    });

    it('should not log warn messages when level is ERROR', () => {
      const logger = new Logger({ level: LogLevel.ERROR });
      logger.warn('Test warn message');

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should log error messages when level is ERROR', () => {
      const logger = new Logger({ level: LogLevel.ERROR });
      logger.error('Test error message');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('ERROR: Test error message'),
      );
    });
  });

  describe('formatMessage', () => {
    it('should include timestamp when timestamp option is true', () => {
      const logger = new Logger({ timestamp: true });
      const formattedMessage = logger['formatMessage']('INFO', 'Test message');

      expect(formattedMessage).toMatch(
        /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] INFO: Test message/,
      );
    });

    it('should not include timestamp when timestamp option is false', () => {
      const logger = new Logger({ timestamp: false });
      const formattedMessage = logger['formatMessage']('INFO', 'Test message');

      expect(formattedMessage).toBe('INFO: Test message');
    });
  });

  describe('writeLog', () => {
    it('should write to console when logToConsole is true', () => {
      const logger = new Logger({ logToConsole: true, logToFile: false });
      logger.info('Test message');

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('INFO: Test message'));
    });

    it('should not write to console when logToConsole is false', () => {
      const logger = new Logger({ logToConsole: false, logToFile: false });
      logger.info('Test message');

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should write to file when logToFile is true', () => {
      const logger = new Logger({
        logToFile: true,
        logFilePath: testLogFilePath,
        logToConsole: false,
      });

      logger.info('Test message');

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        testLogFilePath,
        expect.stringContaining('INFO: Test message'),
      );
    });

    it('should handle file write errors', () => {
      (fs.appendFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File write error');
      });

      const logger = new Logger({
        logToFile: true,
        logFilePath: testLogFilePath,
      });

      logger.info('Test message');

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to write to log file'),
      );
    });
  });
});
