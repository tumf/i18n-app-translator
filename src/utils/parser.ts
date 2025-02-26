import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

export interface I18nEntry {
  key: string;
  value: string;
  context?: string;
  file?: string;
  line?: number;
}

export interface I18nData {
  [key: string]: string | I18nData;
}

export class Parser {
  /**
   * Parse a JSON i18n file
   */
  async parseI18nFile(filePath: string): Promise<I18nEntry[]> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const data = JSON.parse(content) as I18nData;
      return this.flattenI18nData(data);
    } catch (error) {
      console.error(`Error parsing i18n file ${filePath}: ${error}`);
      throw error;
    }
  }

  /**
   * Flatten nested i18n data into an array of entries
   */
  private flattenI18nData(
    data: I18nData,
    prefix = '',
    entries: I18nEntry[] = []
  ): I18nEntry[] {
    for (const [key, value] of Object.entries(data)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'string') {
        entries.push({
          key: fullKey,
          value,
        });
      } else {
        this.flattenI18nData(value, fullKey, entries);
      }
    }
    
    return entries;
  }

  /**
   * Extract i18n keys from source code files
   */
  async extractKeysFromSourceCode(
    sourceDir: string,
    patterns: string[] = ['**/*.{js,jsx,ts,tsx}'],
    excludePatterns: string[] = ['**/node_modules/**', '**/dist/**', '**/build/**']
  ): Promise<I18nEntry[]> {
    const entries: I18nEntry[] = [];
    const files = await glob(patterns, {
      cwd: sourceDir,
      ignore: excludePatterns,
      absolute: true,
    });

    for (const file of files) {
      const content = await fs.promises.readFile(file, 'utf8');
      const relativeFile = path.relative(sourceDir, file);
      
      // Extract keys from t function calls: t('key')
      const tFunctionRegex = /t\(\s*['"]([^'"]+)['"]/g;
      let match;
      
      while ((match = tFunctionRegex.exec(content)) !== null) {
        const key = match[1];
        const lineNumber = this.getLineNumber(content, match.index);
        
        entries.push({
          key,
          value: '', // Value will be filled from i18n files
          file: relativeFile,
          line: lineNumber,
        });
      }
      
      // Extract keys from useTranslation hook: const { t } = useTranslation()
      // and then find all t('key') usages
      if (content.includes('useTranslation')) {
        const hookRegex = /const\s*{\s*t\s*}\s*=\s*useTranslation\(\)/g;
        if (hookRegex.test(content)) {
          // Reset regex to search from beginning
          tFunctionRegex.lastIndex = 0;
          
          while ((match = tFunctionRegex.exec(content)) !== null) {
            const key = match[1];
            const lineNumber = this.getLineNumber(content, match.index);
            
            // Check if this key is already added
            const existingEntry = entries.find((e) => 
              e.key === key && e.file === relativeFile && e.line === lineNumber
            );
            
            if (!existingEntry) {
              entries.push({
                key,
                value: '', // Value will be filled from i18n files
                file: relativeFile,
                line: lineNumber,
              });
            }
          }
        }
      }
    }
    
    return entries;
  }

  /**
   * Get line number from character index in content
   */
  private getLineNumber(content: string, index: number): number {
    const lines = content.slice(0, index).split('\n');
    return lines.length;
  }

  /**
   * Compare source and target i18n files to find missing or outdated translations
   */
  compareI18nFiles(
    sourceEntries: I18nEntry[],
    targetEntries: I18nEntry[]
  ): {
    missing: I18nEntry[];
    outdated: { source: I18nEntry; target: I18nEntry }[];
  } {
    const missing: I18nEntry[] = [];
    const outdated: { source: I18nEntry; target: I18nEntry }[] = [];
    
    // Create a map of target entries for quick lookup
    const targetMap = new Map<string, I18nEntry>();
    targetEntries.forEach((entry) => {
      targetMap.set(entry.key, entry);
    });
    
    // Find missing and outdated entries
    for (const sourceEntry of sourceEntries) {
      const targetEntry = targetMap.get(sourceEntry.key);
      
      if (!targetEntry) {
        // Missing translation
        missing.push(sourceEntry);
      } else if (sourceEntry.value !== targetEntry.value) {
        // Potentially outdated translation (source has changed)
        outdated.push({ source: sourceEntry, target: targetEntry });
      }
    }
    
    return { missing, outdated };
  }

  /**
   * Build i18n data from entries
   */
  buildI18nData(entries: I18nEntry[]): I18nData {
    const data: I18nData = {};
    
    for (const entry of entries) {
      const parts = entry.key.split('.');
      let current = data;
      
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part] as I18nData;
      }
      
      const lastPart = parts[parts.length - 1];
      current[lastPart] = entry.value;
    }
    
    return data;
  }

  /**
   * Save i18n data to file
   */
  async saveI18nFile(filePath: string, data: I18nData): Promise<void> {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
      
      await fs.promises.writeFile(
        filePath,
        JSON.stringify(data, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error(`Error saving i18n file ${filePath}: ${error}`);
      throw error;
    }
  }
}

export default Parser; 