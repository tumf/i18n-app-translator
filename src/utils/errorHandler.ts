import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

export enum ErrorLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  FATAL = 'fatal',
}

export interface IErrorOptions {
  level?: ErrorLevel;
  exit?: boolean;
  code?: number;
  details?: unknown;
}

export class AppError extends Error {
  level: ErrorLevel;
  exit: boolean;
  code: number;
  details?: unknown;

  constructor(message: string, options: IErrorOptions = {}) {
    super(message);
    this.name = 'AppError';
    this.level = options.level || ErrorLevel.ERROR;
    this.exit = options.exit ?? this.level === ErrorLevel.FATAL;
    this.code = options.code || 1;
    this.details = options.details;
  }
}

export function handleError(error: unknown): void {
  if (error instanceof AppError) {
    switch (error.level) {
      case ErrorLevel.INFO:
        console.log(chalk.blue(`ℹ️ ${error.message}`));
        break;
      case ErrorLevel.WARNING:
        console.warn(chalk.yellow(`⚠️ ${error.message}`));
        break;
      case ErrorLevel.ERROR:
        console.error(chalk.red(`❌ ${error.message}`));
        break;
      case ErrorLevel.FATAL:
        console.error(chalk.bgRed.white(`💥 FATAL: ${error.message}`));
        break;
    }

    if (error.details) {
      console.log(chalk.gray('Details:'));
      console.log(chalk.gray(JSON.stringify(error.details, null, 2)));
    }

    /* istanbul ignore next */
    if (error.exit) {
      process.exit(error.code);
    }
  } else if (error instanceof Error) {
    console.error(chalk.red(`❌ Unexpected error: ${error.message}`));
    console.error(chalk.gray(error.stack || ''));
    /* istanbul ignore next */
    process.exit(1);
  } else {
    console.error(chalk.red('❌ Unknown error occurred'));
    console.error(chalk.gray(String(error)));
    /* istanbul ignore next */
    process.exit(1);
  }
}

export function validateRequiredParams(
  params: Record<string, unknown>,
  requiredParams: string[],
): void {
  const missingParams = requiredParams.filter((param) => params[param] === undefined);

  if (missingParams.length > 0) {
    throw new AppError(`Missing required parameters: ${missingParams.join(', ')}`, {
      level: ErrorLevel.ERROR,
      exit: true,
    });
  }
}

export function validateFileExists(filePath: string, fileType: string): void {
  if (!fs.existsSync(filePath)) {
    throw new AppError(`${fileType} file not found: ${filePath}`, {
      level: ErrorLevel.ERROR,
      exit: true,
    });
  }
}

export function validateFileFormat(filePath: string, expectedFormat: string): void {
  const extension = path.extname(filePath).toLowerCase();

  if (extension !== `.${expectedFormat.toLowerCase()}`) {
    throw new AppError(`Invalid file format. Expected .${expectedFormat} but got ${extension}`, {
      level: ErrorLevel.ERROR,
      exit: true,
    });
  }
}

export function validateEnvironmentVars(requiredVars: string[]): void {
  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new AppError(`Missing required environment variables: ${missingVars.join(', ')}`, {
      level: ErrorLevel.ERROR,
      exit: true,
      details: 'Please check your .env file or set these variables in your environment.',
    });
  }
}
