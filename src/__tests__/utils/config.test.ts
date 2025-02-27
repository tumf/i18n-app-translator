import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import type { IConfig } from '../../utils/config';
import { ConfigManager, DEFAULT_CONFIG } from '../../utils/config';
import { LogLevel } from '../../utils/logger';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

// Mock path module
jest.mock('path', () => ({
  join: jest.fn().mockImplementation((...args) => args.join('/')),
  dirname: jest.fn().mockReturnValue('/mock/dir'),
}));

// Mock console methods
jest.spyOn(console, 'warn').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('ConfigManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with default config when no config path is provided', () => {
      (path.join as jest.Mock).mockReturnValueOnce('/mock/path/.i18n-app-translatorrc');
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);

      const configManager = new ConfigManager();

      expect(path.join).toHaveBeenCalledWith(expect.any(String), '.i18n-app-translatorrc');
      expect(configManager['config']).toEqual(DEFAULT_CONFIG);
    });

    test('should use provided config path', () => {
      const customPath = '/custom/config/path.json';
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);

      const configManager = new ConfigManager(customPath);

      expect(configManager['configPath']).toBe(customPath);
    });
  });

  describe('loadConfig', () => {
    test('should load and merge user config when config file exists', () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.readFileSync as jest.Mock).mockReturnValueOnce(
        JSON.stringify({
          translation: {
            concurrency: 10,
            debug: true,
          },
        }),
      );

      const configManager = new ConfigManager();

      // Access private method for testing
      const loadConfigMethod = configManager['loadConfig'].bind(configManager);
      loadConfigMethod();

      expect(fs.readFileSync).toHaveBeenCalled();
      expect(configManager['config'].translation?.concurrency).toBe(10);
      expect(configManager['config'].translation?.debug).toBe(true);
      // Other default values should be preserved
      expect(configManager['config'].translation?.showProgress).toBe(
        DEFAULT_CONFIG.translation?.showProgress,
      );
    });

    test('should handle error when reading config file fails', () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Read error');
      });

      const configManager = new ConfigManager();

      // Access private method for testing
      const loadConfigMethod = configManager['loadConfig'].bind(configManager);
      loadConfigMethod();

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error loading config file'),
      );
      expect(configManager['config']).toEqual(DEFAULT_CONFIG);
    });

    test('should handle invalid JSON in config file', () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.readFileSync as jest.Mock).mockReturnValueOnce('invalid json');

      const configManager = new ConfigManager();

      // Access private method for testing
      const loadConfigMethod = configManager['loadConfig'].bind(configManager);
      loadConfigMethod();

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error loading config file'),
      );
      expect(configManager['config']).toEqual(DEFAULT_CONFIG);
    });
  });

  describe('mergeConfigs', () => {
    test('should merge top-level properties', () => {
      const configManager = new ConfigManager();
      const defaultConfig: IConfig = {
        translation: {
          concurrency: 5,
          showProgress: true,
          similarTranslationsLimit: 3,
        },
      };
      const userConfig = {
        translation: {
          concurrency: 10,
        },
      };

      // Access private method for testing
      const mergeConfigsMethod = configManager['mergeConfigs'].bind(configManager);
      const result = mergeConfigsMethod(defaultConfig, userConfig);

      expect(result.translation?.concurrency).toBe(10);
      expect(result.translation?.showProgress).toBe(true);
      expect(result.translation?.similarTranslationsLimit).toBe(3);
    });

    test('should handle nested objects', () => {
      const configManager = new ConfigManager();
      const defaultConfig: IConfig = {
        vectorDB: {
          enabled: false,
          url: 'default-url',
        },
        glossary: {
          enabled: true,
          path: 'default-path',
        },
      };
      const userConfig = {
        vectorDB: {
          url: 'custom-url',
        },
      };

      // Access private method for testing
      const mergeConfigsMethod = configManager['mergeConfigs'].bind(configManager);
      const result = mergeConfigsMethod(defaultConfig, userConfig);

      expect(result.vectorDB?.enabled).toBe(false);
      expect(result.vectorDB?.url).toBe('custom-url');
      expect(result.glossary?.enabled).toBe(true);
      expect(result.glossary?.path).toBe('default-path');
    });

    test('should handle non-object properties', () => {
      const configManager = new ConfigManager();
      const defaultConfig: IConfig = {
        logging: {
          level: LogLevel.INFO,
          logToFile: false,
          logToConsole: true,
          timestamp: true,
        },
      };
      const userConfig = {
        logging: {
          level: LogLevel.DEBUG,
        },
        newProperty: 'new-value',
      };

      // Access private method for testing
      const mergeConfigsMethod = configManager['mergeConfigs'].bind(configManager);
      const result = mergeConfigsMethod(defaultConfig, userConfig) as IConfig & {
        newProperty?: string;
      };

      expect(result.logging?.level).toBe(LogLevel.DEBUG);
      expect(result.logging?.logToFile).toBe(false);
      expect(result.newProperty).toBe('new-value');
    });
  });

  describe('mergeConfigObjects', () => {
    test('should merge nested objects recursively', () => {
      const configManager = new ConfigManager();
      const defaultObj = {
        a: {
          b: {
            c: 1,
            d: 2,
          },
          e: 3,
        },
        f: 4,
      };
      const userObj = {
        a: {
          b: {
            c: 10,
          },
          g: 5,
        },
      };

      // Access private method for testing
      const mergeConfigObjectsMethod = configManager['mergeConfigObjects'].bind(configManager);
      const result = mergeConfigObjectsMethod(defaultObj, userObj);

      expect(result).toEqual({
        a: {
          b: {
            c: 10,
            d: 2,
          },
          e: 3,
          g: 5,
        },
        f: 4,
      });
    });

    test('should handle null values', () => {
      const configManager = new ConfigManager();
      const defaultObj = {
        a: {
          b: 1,
        },
        c: 2,
      };
      const userObj = {
        a: null,
        d: 3,
      };

      // Access private method for testing
      const mergeConfigObjectsMethod = configManager['mergeConfigObjects'].bind(configManager);
      const result = mergeConfigObjectsMethod(defaultObj, userObj);

      expect(result).toEqual({
        a: null,
        c: 2,
        d: 3,
      });
    });
  });

  describe('updateConfig', () => {
    test('should update config with new values', () => {
      const configManager = new ConfigManager();
      const newConfig: Partial<IConfig> = {
        translation: {
          concurrency: 10,
          debug: true,
          showProgress: true,
          similarTranslationsLimit: 3,
        },
      };

      configManager.updateConfig(newConfig);

      expect(configManager['config'].translation?.concurrency).toBe(10);
      expect(configManager['config'].translation?.debug).toBe(true);
      // Other default values should be preserved
      expect(configManager['config'].translation?.showProgress).toBe(
        DEFAULT_CONFIG.translation?.showProgress,
      );
    });
  });

  describe('saveConfig', () => {
    test('should save config to file', () => {
      const configManager = new ConfigManager('/mock/config/path.json');

      // Access private method for testing
      const saveConfigMethod = configManager['saveConfig'].bind(configManager);
      saveConfigMethod();

      expect(fs.writeFileSync).toHaveBeenCalledWith('/mock/config/path.json', expect.any(String));
    });

    test('should handle error when saving config file fails', () => {
      const configManager = new ConfigManager();
      (fs.writeFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Write error');
      });

      // Access private method for testing
      const saveConfigMethod = configManager['saveConfig'].bind(configManager);
      saveConfigMethod();

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error saving config file'),
      );
    });
  });

  describe('getConfig', () => {
    test('should return current config', () => {
      const configManager = new ConfigManager();
      const customConfig = { ...DEFAULT_CONFIG };
      configManager['config'] = customConfig;

      // Access private method for testing
      const getConfigMethod = configManager['getConfig'].bind(configManager);
      const result = getConfigMethod();

      expect(result).toBe(customConfig);
    });
  });
});
