import fs from 'fs';
import path from 'path';
import { Parser } from '../utils/parser';
import { Translator } from '../utils/translator';
import { Glossary } from '../utils/glossary';
import { createVectorDBClient } from '../utils/vectorDBClient';
import type { IVectorDBClient } from '../utils/vectorDBClient';
import configManager from '../utils/config';
import logger from '../utils/logger';

export interface ITranslateOptions {
  source: string;
  dest: string;
  lang: string;
  useVectorDB?: boolean;
  useGlossary?: boolean;
  glossaryPath?: string;
  context?: string;
  concurrency?: number;
  showProgress?: boolean;
  configPath?: string;
}

export async function translate(options: ITranslateOptions): Promise<void> {
  // Load config if configPath is provided
  if (options.configPath) {
    // Create a new config manager with the specified path
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newConfigManager = new (configManager.constructor as any)(options.configPath);
    // Use the new config
    configManager.updateConfig(newConfigManager.getConfig());
  }

  const config = configManager.getConfig();

  const {
    source,
    dest,
    lang,
    useVectorDB = config.vectorDB?.enabled ?? true,
    useGlossary = config.glossary?.enabled ?? true,
    glossaryPath = config.glossary?.path ?? path.join(process.cwd(), 'glossary.json'),
    context,
    concurrency = config.translation?.concurrency ?? 5,
    showProgress = config.translation?.showProgress ?? true,
  } = options;

  logger.info(`Translating from ${source} to ${dest} (${lang})...`);

  try {
    // Initialize parser
    const parser = new Parser();

    // Load source file
    logger.info(`Loading source file: ${source}`);
    const sourceEntries = await parser.parseI18nFile(source);
    logger.info(`Loaded ${sourceEntries.length} entries from source file`);

    // Load target file if it exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let targetEntries: any[] = [];
    try {
      if (fs.existsSync(dest)) {
        logger.info(`Loading target file: ${dest}`);
        targetEntries = await parser.parseI18nFile(dest);
        logger.info(`Loaded ${targetEntries.length} entries from target file`);
      }
    } catch (error) {
      logger.warn(`Error loading target file: ${error}`);
      logger.info('Will create a new target file');
    }

    // Create a map of target entries for quick lookup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const targetMap = new Map<string, any>();
    targetEntries.forEach((entry) => {
      targetMap.set(entry.key, entry);
    });

    // Find entries that need translation
    const entriesToTranslate = sourceEntries.filter((entry) => !targetMap.has(entry.key));
    logger.info(`Found ${entriesToTranslate.length} entries that need translation`);

    if (entriesToTranslate.length === 0) {
      logger.info('No entries need translation. Exiting.');
      return;
    }

    // Initialize vector DB client if enabled
    let vectorDBClient: IVectorDBClient | undefined = undefined;
    if (useVectorDB) {
      try {
        logger.info('Initializing vector DB client...');
        vectorDBClient = createVectorDBClient({
          url: config.vectorDB?.url,
          apiKey: config.vectorDB?.apiKey,
          namespace: config.vectorDB?.namespace,
        });
        await vectorDBClient.initialize();
        logger.info('Vector DB client initialized');
      } catch (error) {
        logger.warn(`Error initializing vector DB client: ${error}`);
        logger.info('Will proceed without vector DB');
        vectorDBClient = undefined;
      }
    }

    // Initialize glossary if enabled
    let glossary: Glossary | undefined = undefined;
    if (useGlossary) {
      try {
        logger.info(`Loading glossary from: ${glossaryPath}`);
        glossary = new Glossary(glossaryPath);
        await glossary.load();
        logger.info(`Loaded ${glossary.getAllEntries().length} glossary entries`);
      } catch (error) {
        logger.warn(`Error loading glossary: ${error}`);
        logger.info('Will proceed without glossary');
        glossary = undefined;
      }
    }

    // Initialize translator
    const translator = new Translator(vectorDBClient, glossary);

    // Translate entries
    logger.info('Starting translation...');
    const translationResults = await translator.batchTranslate(entriesToTranslate, lang, {
      useVectorDB,
      useGlossary,
      context,
      concurrency,
      showProgress,
      similarTranslationsLimit: config.translation?.similarTranslationsLimit ?? 3,
    });
    logger.info(`Translated ${translationResults.size} entries`);

    // Merge translations with existing entries
    const allEntries = [...targetEntries];

    for (const sourceEntry of sourceEntries) {
      const existingEntry = targetMap.get(sourceEntry.key);

      if (!existingEntry) {
        const translationResult = translationResults.get(sourceEntry.key);

        if (translationResult) {
          allEntries.push({
            key: sourceEntry.key,
            value: translationResult.translated,
            context: sourceEntry.context,
          });
        }
      }
    }

    // Build and save i18n data
    logger.info(`Building and saving i18n data to: ${dest}`);
    const i18nData = parser.buildI18nData(allEntries);
    await parser.saveI18nFile(dest, i18nData);
    logger.info('Translation completed successfully');

    // Close vector DB client
    if (vectorDBClient) {
      await vectorDBClient.close();
    }
  } catch (error) {
    logger.error(`Error during translation: ${error}`);
    process.exit(1);
  }
}

export default translate;
