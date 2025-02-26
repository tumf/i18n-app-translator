import fs from 'fs';
import path from 'path';
import { Parser } from '../utils/parser';
import { Translator } from '../utils/translator';
import { Glossary } from '../utils/glossary';
import { createVectorDBClient } from '../utils/vectorDBClient';
import type { IVectorDBClient } from '../utils/vectorDBClient';

export interface ITranslateOptions {
  source: string;
  dest: string;
  lang: string;
  useVectorDB?: boolean;
  useGlossary?: boolean;
  glossaryPath?: string;
  context?: string;
}

export async function translate(options: ITranslateOptions): Promise<void> {
  const {
    source,
    dest,
    lang,
    useVectorDB = true,
    useGlossary = true,
    glossaryPath = path.join(process.cwd(), 'glossary.json'),
    context,
  } = options;

  console.log(`Translating from ${source} to ${dest} (${lang})...`);

  try {
    // Initialize parser
    const parser = new Parser();
    
    // Load source file
    console.log(`Loading source file: ${source}`);
    const sourceEntries = await parser.parseI18nFile(source);
    console.log(`Loaded ${sourceEntries.length} entries from source file`);
    
    // Load target file if it exists
    let targetEntries: any[] = [];
    try {
      if (fs.existsSync(dest)) {
        console.log(`Loading target file: ${dest}`);
        targetEntries = await parser.parseI18nFile(dest);
        console.log(`Loaded ${targetEntries.length} entries from target file`);
      }
    } catch (error) {
      console.warn(`Error loading target file: ${error}`);
      console.log('Will create a new target file');
    }
    
    // Create a map of target entries for quick lookup
    const targetMap = new Map<string, any>();
    targetEntries.forEach((entry) => {
      targetMap.set(entry.key, entry);
    });
    
    // Find entries that need translation
    const entriesToTranslate = sourceEntries.filter((entry) => !targetMap.has(entry.key));
    console.log(`Found ${entriesToTranslate.length} entries that need translation`);
    
    if (entriesToTranslate.length === 0) {
      console.log('No entries need translation. Exiting.');
      return;
    }
    
    // Initialize vector DB client if enabled
    let vectorDBClient: IVectorDBClient | undefined = undefined;
    if (useVectorDB) {
      try {
        console.log('Initializing vector DB client...');
        vectorDBClient = createVectorDBClient();
        await vectorDBClient.initialize();
        console.log('Vector DB client initialized');
      } catch (error) {
        console.warn(`Error initializing vector DB client: ${error}`);
        console.log('Will proceed without vector DB');
        vectorDBClient = undefined;
      }
    }
    
    // Initialize glossary if enabled
    let glossary: Glossary | undefined = undefined;
    if (useGlossary) {
      try {
        console.log(`Loading glossary from: ${glossaryPath}`);
        glossary = new Glossary(glossaryPath);
        await glossary.load();
        console.log(`Loaded ${glossary.getAllEntries().length} glossary entries`);
      } catch (error) {
        console.warn(`Error loading glossary: ${error}`);
        console.log('Will proceed without glossary');
        glossary = undefined;
      }
    }
    
    // Initialize translator
    const translator = new Translator(vectorDBClient, glossary);
    
    // Translate entries
    console.log('Starting translation...');
    const translationResults = await translator.batchTranslate(
      entriesToTranslate,
      lang,
      { useVectorDB, useGlossary, context }
    );
    console.log(`Translated ${translationResults.size} entries`);
    
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
    console.log(`Building and saving i18n data to: ${dest}`);
    const i18nData = parser.buildI18nData(allEntries);
    await parser.saveI18nFile(dest, i18nData);
    console.log('Translation completed successfully');
    
    // Close vector DB client
    if (vectorDBClient) {
      await vectorDBClient.close();
    }
  } catch (error) {
    console.error(`Error during translation: ${error}`);
    process.exit(1);
  }
}

export default translate; 