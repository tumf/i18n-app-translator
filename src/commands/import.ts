import fs from 'fs';
import path from 'path';
import { Parser } from '../utils/parser';
import { Glossary } from '../utils/glossary';
import type { IGlossaryEntry } from '../utils/glossary';

export interface IImportOptions {
  source: string;
  type: 'glossary' | 'translations';
  dest?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  glossaryPath?: string;
  format?: 'json' | 'csv';
}

export async function importData(options: IImportOptions): Promise<void> {
  const {
    source,
    type,
    dest,
    sourceLanguage = 'en',
    targetLanguage,
    glossaryPath = path.join(process.cwd(), 'glossary.json'),
    format = 'json',
  } = options;

  console.log(`Importing ${type} from ${source}...`);

  try {
    if (type === 'glossary') {
      await importGlossary(source, glossaryPath, sourceLanguage, targetLanguage, format);
    } else if (type === 'translations') {
      if (!dest) {
        console.error('Destination file (--dest) is required for translations import');
        process.exit(1);
      }
      if (!targetLanguage) {
        console.error('Target language (--targetLanguage) is required for translations import');
        process.exit(1);
      }
      await importTranslations(source, dest, sourceLanguage, targetLanguage, format);
    } else {
      console.error(`Unknown import type: ${type}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error during import: ${error}`);
    process.exit(1);
  }
}

/**
 * Import glossary entries from external source
 */
async function importGlossary(
  sourcePath: string,
  glossaryPath: string,
  sourceLanguage: string,
  targetLanguage?: string,
  format: 'json' | 'csv' = 'json',
): Promise<void> {
  console.log(`Importing glossary from ${sourcePath} to ${glossaryPath}...`);

  // Load existing glossary or create new one
  const glossary = new Glossary(glossaryPath);
  await glossary.load();

  // Read source file
  const content = await fs.promises.readFile(sourcePath, 'utf8');

  let entries: Array<{
    term: string;
    translation: string;
    context?: string;
    notes?: string;
  }> = [];

  // Parse source file based on format
  if (format === 'json') {
    entries = JSON.parse(content);
  } else if (format === 'csv') {
    // Simple CSV parsing (term,translation,context,notes)
    entries = content
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => {
        const [term, translation, context, notes] = line.split(',').map((item) => item.trim());
        return { term, translation, context, notes };
      });
  }

  // Add entries to glossary
  let addedCount = 0;
  for (const entry of entries) {
    if (!entry.term || !entry.translation) {
      console.warn(`Skipping invalid entry: ${JSON.stringify(entry)}`);
      continue;
    }

    const glossaryEntry: IGlossaryEntry = {
      term: entry.term,
      translations: {
        [targetLanguage || sourceLanguage]: entry.translation,
      },
    };

    if (entry.context) {
      glossaryEntry.context = entry.context;
    }

    if (entry.notes) {
      glossaryEntry.notes = entry.notes;
    }

    glossary.addEntry(glossaryEntry);
    addedCount++;
  }

  // Save glossary
  await glossary.save();
  console.log(`Imported ${addedCount} glossary entries successfully`);
}

/**
 * Import translations from external source
 */
async function importTranslations(
  sourcePath: string,
  destPath: string,
  sourceLanguage: string,
  targetLanguage: string,
  format: 'json' | 'csv' = 'json',
): Promise<void> {
  console.log(`Importing translations from ${sourcePath} to ${destPath}...`);

  const parser = new Parser();

  // Read source file
  const content = await fs.promises.readFile(sourcePath, 'utf8');

  let translations: Array<{
    key: string;
    value: string;
  }> = [];

  // Parse source file based on format
  if (format === 'json') {
    // If it's a flat JSON object
    const data = JSON.parse(content);

    if (typeof data === 'object' && !Array.isArray(data)) {
      translations = Object.entries(data).map(([key, value]) => ({
        key,
        value: String(value),
      }));
    } else if (Array.isArray(data)) {
      // If it's already an array of entries
      translations = data;
    }
  } else if (format === 'csv') {
    // Simple CSV parsing (key,value)
    translations = content
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => {
        const [key, value] = line.split(',').map((item) => item.trim());
        return { key, value };
      });
  }

  // Load existing translations if destination file exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let existingEntries: any[] = [];
  try {
    if (fs.existsSync(destPath)) {
      existingEntries = await parser.parseI18nFile(destPath);
    }
  } catch (error) {
    console.warn(`Error loading existing translations: ${error}`);
    console.log('Will create a new file');
  }

  // Create a map of existing entries for quick lookup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingMap = new Map<string, any>();
  existingEntries.forEach((entry) => {
    existingMap.set(entry.key, entry);
  });

  // Merge translations with existing entries
  let addedCount = 0;
  let updatedCount = 0;

  for (const translation of translations) {
    if (!translation.key || !translation.value) {
      console.warn(`Skipping invalid translation: ${JSON.stringify(translation)}`);
      continue;
    }

    const existingEntry = existingMap.get(translation.key);

    if (existingEntry) {
      existingEntry.value = translation.value;
      updatedCount++;
    } else {
      existingEntries.push({
        key: translation.key,
        value: translation.value,
      });
      addedCount++;
    }
  }

  // Build and save i18n data
  const i18nData = parser.buildI18nData(existingEntries);
  await parser.saveI18nFile(destPath, i18nData);

  console.log(`Imported translations successfully: ${addedCount} added, ${updatedCount} updated`);
}

export default importData;
