import { generateTranslation, reviewTranslation } from './aiClient';
import type { IVectorDBClient } from './vectorDBClient';
import type { I18nEntry } from './parser';
import type { Glossary } from './glossary';

export interface ITranslationOptions {
  useVectorDB?: boolean;
  useGlossary?: boolean;
  similarTranslationsLimit?: number;
  context?: string;
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
  
  constructor(
    vectorDBClient?: IVectorDBClient,
    glossary?: Glossary
  ) {
    this.vectorDBClient = vectorDBClient || null;
    this.glossary = glossary || null;
  }
  
  /**
   * Translate a single entry
   */
  async translateEntry(
    entry: I18nEntry,
    targetLanguage: string,
    options: ITranslationOptions = {}
  ): Promise<ITranslationResult> {
    const {
      useVectorDB = true,
      useGlossary = true,
      similarTranslationsLimit = 3,
      context = entry.context,
    } = options;
    
    let similarTranslations;
    let glossaryTerms;
    
    // Get similar translations from vector DB if enabled
    if (useVectorDB && this.vectorDBClient) {
      try {
        similarTranslations = await this.vectorDBClient.findSimilarTranslations(
          entry.value,
          targetLanguage,
          similarTranslationsLimit
        );
      } catch (error) {
        console.warn(`Error finding similar translations: ${error}`);
        similarTranslations = [];
      }
    }
    
    // Get glossary terms if enabled
    if (useGlossary && this.glossary) {
      try {
        glossaryTerms = this.glossary.getEntriesForLanguage(targetLanguage);
      } catch (error) {
        console.warn(`Error getting glossary terms: ${error}`);
        glossaryTerms = {};
      }
    }
    
    // Generate translation
    const translatedText = await generateTranslation(
      entry.value,
      targetLanguage,
      context,
      similarTranslations,
      glossaryTerms
    );
    
    // Store translation in vector DB if enabled
    if (useVectorDB && this.vectorDBClient) {
      try {
        await this.vectorDBClient.addTranslation(
          entry.value,
          translatedText,
          targetLanguage,
          context
        );
      } catch (error) {
        console.warn(`Error storing translation in vector DB: ${error}`);
      }
    }
    
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
    options: ITranslationOptions = {}
  ): Promise<ITranslationResult> {
    const {
      useGlossary = true,
      context = sourceEntry.context || targetEntry.context,
    } = options;
    
    let glossaryTerms;
    
    // Get glossary terms if enabled
    if (useGlossary && this.glossary) {
      try {
        glossaryTerms = this.glossary.getEntriesForLanguage(targetLanguage);
      } catch (error) {
        console.warn(`Error getting glossary terms: ${error}`);
        glossaryTerms = {};
      }
    }
    
    // Review translation
    const { improved, changes } = await reviewTranslation(
      sourceEntry.value,
      targetEntry.value,
      targetLanguage,
      context,
      glossaryTerms
    );
    
    // Store improved translation in vector DB if it was changed
    if (
      improved !== targetEntry.value &&
      this.vectorDBClient
    ) {
      try {
        await this.vectorDBClient.addTranslation(
          sourceEntry.value,
          improved,
          targetLanguage,
          context
        );
      } catch (error) {
        console.warn(`Error storing improved translation in vector DB: ${error}`);
      }
    }
    
    return {
      original: sourceEntry.value,
      translated: improved,
      isNew: false,
      changes,
    };
  }
  
  /**
   * Batch translate multiple entries
   */
  async batchTranslate(
    entries: I18nEntry[],
    targetLanguage: string,
    options: ITranslationOptions = {}
  ): Promise<Map<string, ITranslationResult>> {
    const results = new Map<string, ITranslationResult>();
    
    for (const entry of entries) {
      try {
        const result = await this.translateEntry(entry, targetLanguage, options);
        results.set(entry.key, result);
      } catch (error) {
        console.error(`Error translating entry ${entry.key}: ${error}`);
      }
    }
    
    return results;
  }
  
  /**
   * Batch review multiple entries
   */
  async batchReview(
    sourceEntries: I18nEntry[],
    targetEntries: I18nEntry[],
    targetLanguage: string,
    options: ITranslationOptions = {}
  ): Promise<Map<string, ITranslationResult>> {
    const results = new Map<string, ITranslationResult>();
    const targetMap = new Map<string, I18nEntry>();
    
    // Create a map of target entries for quick lookup
    targetEntries.forEach((entry) => {
      targetMap.set(entry.key, entry);
    });
    
    for (const sourceEntry of sourceEntries) {
      const targetEntry = targetMap.get(sourceEntry.key);
      
      if (targetEntry) {
        try {
          const result = await this.reviewEntry(
            sourceEntry,
            targetEntry,
            targetLanguage,
            options
          );
          results.set(sourceEntry.key, result);
        } catch (error) {
          console.error(`Error reviewing entry ${sourceEntry.key}: ${error}`);
        }
      }
    }
    
    return results;
  }
}

export default Translator; 