import fs from 'fs';
import path from 'path';
import { LogLevel } from './logger';

export interface IVectorDBConfig {
  enabled: boolean;
  url?: string;
  apiKey?: string;
  namespace?: string;
}

export interface IGlossaryConfig {
  enabled: boolean;
  path?: string;
}

export interface ITranslationConfig {
  concurrency: number;
  showProgress: boolean;
  similarTranslationsLimit: number;
  debug?: boolean;
}

export interface ILoggingConfig {
  level: LogLevel;
  logToFile: boolean;
  logFilePath?: string;
  logToConsole: boolean;
  timestamp: boolean;
}

export interface IConfig {
  // Vector DB settings
  vectorDB?: IVectorDBConfig;

  // Glossary settings
  glossary?: IGlossaryConfig;

  // Translation settings
  translation?: ITranslationConfig;

  // Logging settings
  logging?: ILoggingConfig;
}

export const DEFAULT_CONFIG: IConfig = {
  vectorDB: {
    enabled: true,
  },
  glossary: {
    enabled: true,
    path: 'glossary.json',
  },
  translation: {
    concurrency: 5,
    showProgress: true,
    similarTranslationsLimit: 3,
    debug: false,
  },
  logging: {
    level: LogLevel.INFO,
    logToFile: false,
    logToConsole: true,
    timestamp: true,
  },
};

export class ConfigManager {
  private config: IConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), '.i18n-app-translatorrc');
    this.config = { ...DEFAULT_CONFIG };
    this.loadConfig();
  }

  /* istanbul ignore next */
  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const configContent = fs.readFileSync(this.configPath, 'utf-8');
        const userConfig = JSON.parse(configContent);

        // Deep merge user config with default config
        this.config = this.mergeConfigs(DEFAULT_CONFIG, userConfig);
      }
    } catch (error) {
      console.warn(`Error loading config file: ${error}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mergeConfigs(defaultConfig: IConfig, userConfig: any): IConfig {
    const result: IConfig = { ...defaultConfig };

    for (const key in userConfig) {
      if (Object.prototype.hasOwnProperty.call(userConfig, key)) {
        if (
          typeof userConfig[key] === 'object' &&
          userConfig[key] !== null &&
          key in defaultConfig &&
          typeof defaultConfig[key as keyof IConfig] === 'object'
        ) {
          // Type assertion to handle nested objects
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const defaultValue = defaultConfig[key as keyof IConfig] as any;
          const mergedValue = this.mergeConfigObjects(defaultValue, userConfig[key]);
          result[key as keyof IConfig] = mergedValue;
        } else {
          result[key as keyof IConfig] = userConfig[key];
        }
      }
    }

    return result;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mergeConfigObjects(defaultObj: any, userObj: any): any {
    const result = { ...defaultObj };

    for (const key in userObj) {
      if (Object.prototype.hasOwnProperty.call(userObj, key)) {
        if (
          typeof userObj[key] === 'object' &&
          userObj[key] !== null &&
          key in defaultObj &&
          typeof defaultObj[key] === 'object'
        ) {
          result[key] = this.mergeConfigObjects(defaultObj[key], userObj[key]);
        } else {
          result[key] = userObj[key];
        }
      }
    }

    return result;
  }

  /* istanbul ignore next */
  getConfig(): IConfig {
    return this.config;
  }

  /* istanbul ignore next */
  saveConfig(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error(`Error saving config file: ${error}`);
    }
  }

  updateConfig(newConfig: Partial<IConfig>): void {
    this.config = this.mergeConfigs(this.config, newConfig);
  }
}

// Create a default config manager instance
const defaultConfigManager = new ConfigManager();

export default defaultConfigManager;
