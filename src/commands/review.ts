import fs from 'fs';
import path from 'path';
import { Parser } from '../utils/parser';
import { Translator } from '../utils/translator';
import { Glossary } from '../utils/glossary';
import { createVectorDBClient } from '../utils/vectorDBClient';
import type { IVectorDBClient } from '../utils/vectorDBClient';

export interface IReviewOptions {
  source: string;
  dest: string;
  lang: string;
  useVectorDB?: boolean;
  useGlossary?: boolean;
  glossaryPath?: string;
  context?: string;
  all?: boolean;
}

export async function review(options: IReviewOptions): Promise<void> {
  const {
    source,
    dest,
    lang,
    useVectorDB = true,
    useGlossary = true,
    glossaryPath = path.join(process.cwd(), 'glossary.json'),
    context,
    all = false,
  } = options;

  console.log(`Reviewing translations from ${source} to ${dest} (${lang})...`);

  try {
    // Initialize parser
    const parser = new Parser();

    // Load source file
    console.log(`Loading source file: ${source}`);
    const sourceEntries = await parser.parseI18nFile(source);
    console.log(`Loaded ${sourceEntries.length} entries from source file`);

    // Load target file
    if (!fs.existsSync(dest)) {
      console.error(`Target file ${dest} does not exist. Use translate command first.`);
      process.exit(1);
    }

    console.log(`Loading target file: ${dest}`);
    const targetEntries = await parser.parseI18nFile(dest);
    console.log(`Loaded ${targetEntries.length} entries from target file`);

    // Compare files to find outdated translations
    const { outdated } = parser.compareI18nFiles(sourceEntries, targetEntries);

    // If all flag is set, review all translations
    const entriesToReview = all
      ? sourceEntries.filter((sourceEntry) =>
          targetEntries.some((targetEntry) => targetEntry.key === sourceEntry.key),
        )
      : outdated.map((item) => item.source);

    console.log(`Found ${entriesToReview.length} entries to review`);

    if (entriesToReview.length === 0) {
      console.log('No entries need review. Exiting.');
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

    // Create maps for quick lookup
    const sourceMap = new Map();
    sourceEntries.forEach((entry) => {
      sourceMap.set(entry.key, entry);
    });

    const targetMap = new Map();
    targetEntries.forEach((entry) => {
      targetMap.set(entry.key, entry);
    });

    // Review entries
    console.log('Starting review...');
    const reviewResults = await translator.batchReview(entriesToReview, targetEntries, lang, {
      useGlossary,
      context,
    });
    console.log(`Reviewed ${reviewResults.size} entries`);

    // Count changes
    let changedCount = 0;
    reviewResults.forEach((result) => {
      if (result.changes && result.changes !== 'No changes needed') {
        changedCount++;
      }
    });
    console.log(`Improved ${changedCount} translations`);

    // Update target entries with improved translations
    const updatedEntries = [...targetEntries];

    for (let i = 0; i < updatedEntries.length; i++) {
      const entry = updatedEntries[i];
      const reviewResult = reviewResults.get(entry.key);

      if (reviewResult) {
        updatedEntries[i] = {
          ...entry,
          value: reviewResult.translated,
        };
      }
    }

    // Build and save i18n data
    console.log(`Building and saving i18n data to: ${dest}`);
    const i18nData = parser.buildI18nData(updatedEntries);
    await parser.saveI18nFile(dest, i18nData);
    console.log('Review completed successfully');

    // Close vector DB client
    if (vectorDBClient) {
      await vectorDBClient.close();
    }
  } catch (error) {
    console.error(`Error during review: ${error}`);
    process.exit(1);
  }
}

export default review;
