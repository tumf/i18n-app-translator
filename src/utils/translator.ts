import { generateTranslation, reviewTranslation } from './aiClient';
import type { IVectorDBClient } from './vectorDBClient';
import type { I18nEntry } from './parser';
import type { Glossary } from './glossary';
import logger from './logger';

export interface ITranslationOptions {
  useVectorDB?: boolean;
  useGlossary?: boolean;
  similarTranslationsLimit?: number;
  context?: string;
  concurrency?: number;
  showProgress?: boolean;
}

export interface ITranslationResult {
  original: string;
  translated: string;
  isNew: boolean;
  changes?: string;
}

export class Translator {
  private vectorDBClient: IVectorDBClient | null = null;
  private glossary: Glossary | null = null;

  constructor(vectorDBClient?: IVectorDBClient, glossary?: Glossary) {
    this.vectorDBClient = vectorDBClient || null;
    this.glossary = glossary || null;
  }

  /**
   * Translate a single entry
   */
  async translateEntry(
    entry: I18nEntry,
    targetLanguage: string,
    options: ITranslationOptions = {},
  ): Promise<ITranslationResult> {
    const {
      useVectorDB = true,
      useGlossary = true,
      similarTranslationsLimit = 3,
      context = entry.context,
    } = options;

    let similarTranslations;
    let glossaryTerms;

    logger.debug(`Translating entry: ${entry.key}`);

    // Get similar translations from vector DB if enabled
    if (useVectorDB && this.vectorDBClient) {
      try {
        logger.debug(`Finding similar translations for: ${entry.key}`);
        similarTranslations = await this.vectorDBClient.findSimilarTranslations(
          entry.value,
          targetLanguage,
          similarTranslationsLimit,
        );
      } catch (error) {
        logger.warn(`Error finding similar translations: ${error}`);
        similarTranslations = [];
      }
    }

    // Get glossary terms if enabled
    if (useGlossary && this.glossary) {
      try {
        logger.debug(`Getting glossary terms for language: ${targetLanguage}`);
        glossaryTerms = this.glossary.getEntriesForLanguage(targetLanguage);
      } catch (error) {
        logger.warn(`Error getting glossary terms: ${error}`);
        glossaryTerms = {};
      }
    }

    // Generate translation
    logger.debug(`Generating translation for: ${entry.key}`);
    const translatedText = await generateTranslation(
      entry.value,
      targetLanguage,
      context,
      similarTranslations,
      glossaryTerms,
    );

    // Store translation in vector DB if enabled
    if (useVectorDB && this.vectorDBClient) {
      try {
        logger.debug(`Storing translation in vector DB: ${entry.key}`);
        await this.vectorDBClient.addTranslation(
          entry.value,
          translatedText,
          targetLanguage,
          context,
        );
      } catch (error) {
        logger.warn(`Error storing translation in vector DB: ${error}`);
      }
    }

    logger.debug(`Translation completed for: ${entry.key}`);
    return {
      original: entry.value,
      translated: translatedText,
      isNew: true,
    };
  }

  /**
   * Review and improve an existing translation
   */
  async reviewEntry(
    sourceEntry: I18nEntry,
    targetEntry: I18nEntry,
    targetLanguage: string,
    options: ITranslationOptions = {},
  ): Promise<ITranslationResult> {
    const { useGlossary = true, context = sourceEntry.context || targetEntry.context } = options;

    let glossaryTerms;

    logger.debug(`Reviewing entry: ${sourceEntry.key}`);

    // Get glossary terms if enabled
    if (useGlossary && this.glossary) {
      try {
        logger.debug(`Getting glossary terms for language: ${targetLanguage}`);
        glossaryTerms = this.glossary.getEntriesForLanguage(targetLanguage);
      } catch (error) {
        logger.warn(`Error getting glossary terms: ${error}`);
        glossaryTerms = {};
      }
    }

    // Review translation
    logger.debug(`Reviewing translation for: ${sourceEntry.key}`);
    const { improved, changes } = await reviewTranslation(
      sourceEntry.value,
      targetEntry.value,
      targetLanguage,
      context,
      glossaryTerms,
    );

    // Store improved translation in vector DB if it was changed
    if (improved !== targetEntry.value && this.vectorDBClient) {
      try {
        logger.debug(`Storing improved translation in vector DB: ${sourceEntry.key}`);
        await this.vectorDBClient.addTranslation(
          sourceEntry.value,
          improved,
          targetLanguage,
          context,
        );
      } catch (error) {
        logger.warn(`Error storing improved translation in vector DB: ${error}`);
      }
    }

    logger.debug(`Review completed for: ${sourceEntry.key}`);
    return {
      original: sourceEntry.value,
      translated: improved,
      isNew: false,
      changes,
    };
  }

  /**
   * Batch translate multiple entries with concurrency control
   */
  async batchTranslate(
    entries: I18nEntry[],
    targetLanguage: string,
    options: ITranslationOptions = {},
  ): Promise<Map<string, ITranslationResult>> {
    const { concurrency = 5, showProgress = true } = options;

    const results = new Map<string, ITranslationResult>();
    const total = entries.length;
    let completed = 0;

    logger.info(`Starting batch translation of ${total} entries with concurrency ${concurrency}`);

    if (showProgress) {
      console.log(`Starting batch translation of ${total} entries with concurrency ${concurrency}`);
    }

    // Process entries in batches based on concurrency
    for (let i = 0; i < total; i += concurrency) {
      const batch = entries.slice(i, i + concurrency);
      const batchNumber = Math.floor(i / concurrency) + 1;
      const totalBatches = Math.ceil(total / concurrency);

      logger.info(`Processing batch ${batchNumber}/${totalBatches}`);

      if (showProgress) {
        console.log(`Processing batch ${batchNumber}/${totalBatches}`);
      }

      // Process batch in parallel
      const batchPromises = batch.map(async (entry) => {
        try {
          const result = await this.translateEntry(entry, targetLanguage, options);
          results.set(entry.key, result);

          completed++;
          logger.info(
            `Progress: ${completed}/${total} (${Math.round((completed / total) * 100)}%)`,
          );

          if (showProgress) {
            console.log(
              `Progress: ${completed}/${total} (${Math.round((completed / total) * 100)}%)`,
            );
          }

          return { key: entry.key, success: true };
        } catch (error) {
          logger.error(`Error translating entry ${entry.key}: ${error}`);
          console.error(`Error translating entry ${entry.key}: ${error}`);
          return { key: entry.key, success: false };
        }
      });

      await Promise.all(batchPromises);
    }

    logger.info(
      `Batch translation completed: ${results.size}/${total} entries successfully translated`,
    );

    if (showProgress) {
      console.log(
        `Batch translation completed: ${results.size}/${total} entries successfully translated`,
      );
    }

    return results;
  }

  /**
   * Batch review multiple entries with concurrency control
   */
  async batchReview(
    sourceEntries: I18nEntry[],
    targetEntries: I18nEntry[],
    targetLanguage: string,
    options: ITranslationOptions = {},
  ): Promise<Map<string, ITranslationResult>> {
    const { concurrency = 5, showProgress = true } = options;

    const results = new Map<string, ITranslationResult>();
    const targetMap = new Map<string, I18nEntry>();

    // Create a map of target entries for quick lookup
    targetEntries.forEach((entry) => {
      targetMap.set(entry.key, entry);
    });

    // Filter source entries that have matching target entries
    const entriesToReview = sourceEntries.filter((entry) => targetMap.has(entry.key));
    const total = entriesToReview.length;
    let completed = 0;

    logger.info(`Starting batch review of ${total} entries with concurrency ${concurrency}`);

    if (showProgress) {
      console.log(`Starting batch review of ${total} entries with concurrency ${concurrency}`);
    }

    // Process entries in batches based on concurrency
    for (let i = 0; i < total; i += concurrency) {
      const batch = entriesToReview.slice(i, i + concurrency);
      const batchNumber = Math.floor(i / concurrency) + 1;
      const totalBatches = Math.ceil(total / concurrency);

      logger.info(`Processing batch ${batchNumber}/${totalBatches}`);

      if (showProgress) {
        console.log(`Processing batch ${batchNumber}/${totalBatches}`);
      }

      // Process batch in parallel
      const batchPromises = batch.map(async (sourceEntry) => {
        const targetEntry = targetMap.get(sourceEntry.key);

        if (targetEntry) {
          try {
            const result = await this.reviewEntry(
              sourceEntry,
              targetEntry,
              targetLanguage,
              options,
            );
            results.set(sourceEntry.key, result);

            completed++;
            logger.info(
              `Progress: ${completed}/${total} (${Math.round((completed / total) * 100)}%)`,
            );

            if (showProgress) {
              console.log(
                `Progress: ${completed}/${total} (${Math.round((completed / total) * 100)}%)`,
              );
            }

            return { key: sourceEntry.key, success: true };
          } catch (error) {
            logger.error(`Error reviewing entry ${sourceEntry.key}: ${error}`);
            console.error(`Error reviewing entry ${sourceEntry.key}: ${error}`);
            return { key: sourceEntry.key, success: false };
          }
        }

        return { key: sourceEntry.key, success: false };
      });

      await Promise.all(batchPromises);
    }

    logger.info(`Batch review completed: ${results.size}/${total} entries successfully reviewed`);

    if (showProgress) {
      console.log(`Batch review completed: ${results.size}/${total} entries successfully reviewed`);
    }

    return results;
  }
}

export default Translator;
