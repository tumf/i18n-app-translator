import fs from 'fs';
import path from 'path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface ILoggerOptions {
  level?: LogLevel;
  logToFile?: boolean;
  logFilePath?: string;
  logToConsole?: boolean;
  timestamp?: boolean;
}

export class Logger {
  private level: LogLevel;
  private logToFile: boolean;
  private logFilePath: string;
  private logToConsole: boolean;
  private timestamp: boolean;

  constructor(options: ILoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.logToFile = options.logToFile ?? false;
    this.logFilePath = options.logFilePath ?? path.join(process.cwd(), 'i18n-app-translator.log');
    this.logToConsole = options.logToConsole ?? true;
    this.timestamp = options.timestamp ?? true;

    // Ensure log directory exists if logging to file
    if (this.logToFile) {
      const logDir = path.dirname(this.logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    }
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = this.timestamp ? `[${new Date().toISOString()}] ` : '';
    return `${timestamp}${level}: ${message}`;
  }

  private writeLog(level: string, message: string): void {
    const formattedMessage = this.formatMessage(level, message);

    if (this.logToConsole) {
      console.log(formattedMessage);
    }

    if (this.logToFile) {
      try {
        fs.appendFileSync(this.logFilePath, formattedMessage + '\n');
      } catch (error) {
        console.error(`Failed to write to log file: ${error}`);
      }
    }
  }

  debug(message: string): void {
    if (this.level <= LogLevel.DEBUG) {
      this.writeLog('DEBUG', message);
    }
  }

  info(message: string): void {
    if (this.level <= LogLevel.INFO) {
      this.writeLog('INFO', message);
    }
  }

  warn(message: string): void {
    if (this.level <= LogLevel.WARN) {
      this.writeLog('WARN', message);
    }
  }

  error(message: string): void {
    if (this.level <= LogLevel.ERROR) {
      this.writeLog('ERROR', message);
    }
  }
}

// Create a default logger instance
const defaultLogger = new Logger();

export default defaultLogger;
