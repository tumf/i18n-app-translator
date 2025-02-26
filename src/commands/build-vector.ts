import fs from 'fs';
import { Parser } from '../utils/parser';
import { createVectorDBClient } from '../utils/vectorDBClient';
import type { IVectorDBClient } from '../utils/vectorDBClient';

export interface IBuildVectorOptions {
  source: string;
  target: string;
  sourceLanguage?: string;
  targetLanguage: string;
  context?: string;
  batchSize?: number;
}

export async function buildVector(options: IBuildVectorOptions): Promise<void> {
  const {
    source,
    target,
    targetLanguage,
    context,
    batchSize = 50,
  } = options;

  console.log(`Building vector database from ${source} and ${target}...`);

  try {
    // Initialize parser
    const parser = new Parser();
    
    // Load source file
    console.log(`Loading source file: ${source}`);
    const sourceEntries = await parser.parseI18nFile(source);
    console.log(`Loaded ${sourceEntries.length} entries from source file`);
    
    // Load target file
    if (!fs.existsSync(target)) {
      console.error(`Target file ${target} does not exist. Use translate command first.`);
      process.exit(1);
    }
    
    console.log(`Loading target file: ${target}`);
    const targetEntries = await parser.parseI18nFile(target);
    console.log(`Loaded ${targetEntries.length} entries from target file`);
    
    // Create maps for quick lookup
    const sourceMap = new Map<string, any>();
    sourceEntries.forEach((entry) => {
      sourceMap.set(entry.key, entry);
    });
    
    const targetMap = new Map<string, any>();
    targetEntries.forEach((entry) => {
      targetMap.set(entry.key, entry);
    });
    
    // Find entries that exist in both source and target
    const matchedKeys = sourceEntries
      .filter((entry) => targetMap.has(entry.key))
      .map((entry) => entry.key);
    
    console.log(`Found ${matchedKeys.length} matched entries to add to vector database`);
    
    if (matchedKeys.length === 0) {
      console.log('No matched entries found. Exiting.');
      return;
    }
    
    // Initialize vector DB client
    console.log('Initializing vector DB client...');
    const vectorDBClient: IVectorDBClient = createVectorDBClient();
    await vectorDBClient.initialize();
    console.log('Vector DB client initialized');
    
    // Add entries to vector DB in batches
    console.log(`Adding entries to vector DB in batches of ${batchSize}...`);
    let addedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < matchedKeys.length; i += batchSize) {
      const batchKeys = matchedKeys.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(matchedKeys.length / batchSize)}...`);
      
      const promises = batchKeys.map(async (key) => {
        try {
          const sourceEntry = sourceMap.get(key);
          const targetEntry = targetMap.get(key);
          
          await vectorDBClient.addTranslation(
            sourceEntry.value,
            targetEntry.value,
            targetLanguage,
            context || sourceEntry.context || 'unknown'
          );
          
          return { success: true };
        } catch (error) {
          console.error(`Error adding entry ${key} to vector DB: ${error}`);
          return { success: false };
        }
      });
      
      const results = await Promise.all(promises);
      
      const batchSuccessCount = results.filter((result) => result.success).length;
      const batchErrorCount = results.length - batchSuccessCount;
      
      addedCount += batchSuccessCount;
      errorCount += batchErrorCount;
      
      console.log(`Batch completed: ${batchSuccessCount} added, ${batchErrorCount} errors`);
    }
    
    console.log(`Vector DB build completed: ${addedCount} entries added, ${errorCount} errors`);
    
    // Close vector DB client
    await vectorDBClient.close();
  } catch (error) {
    console.error(`Error building vector database: ${error}`);
    process.exit(1);
  }
}

export default buildVector; 