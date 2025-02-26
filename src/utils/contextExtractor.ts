import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { glob } from 'glob';
import logger from './logger';

const readFile = promisify(fs.readFile);

export interface IContextExtractorOptions {
  /**
   * Maximum number of lines to include before and after the key match
   */
  contextLines?: number;
  /**
   * File patterns to include in the search
   */
  includePatterns?: string[];
  /**
   * File patterns to exclude from the search
   */
  excludePatterns?: string[];
}

export interface IKeyContext {
  /**
   * The translation key
   */
  key: string;
  /**
   * Array of context information for the key
   */
  contexts: {
    /**
     * File path where the key was found
     */
    file: string;
    /**
     * Line number where the key was found
     */
    lineNumber: number;
    /**
     * Context lines around the key
     */
    context: string;
  }[];
}

/**
 * Utility class for extracting context information from codebase
 */
export class ContextExtractor {
  private basePath: string;
  private options: IContextExtractorOptions;

  /**
   * Create a new ContextExtractor
   * @param basePath Base directory path to search in
   * @param options Options for context extraction
   */
  constructor(basePath: string, options: IContextExtractorOptions = {}) {
    this.basePath = basePath;
    this.options = {
      contextLines: options.contextLines ?? 2,
      includePatterns: options.includePatterns ?? [
        '**/*.{txt,md,html,css,js,jsx,ts,tsx,json,xml,yaml,yml,vue,svelte,php,rb,py,java,c,cpp,cs,go}',
      ],
      excludePatterns: options.excludePatterns ?? [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/vendor/**',
      ],
    };
  }

  /**
   * Extract context for a list of translation keys
   * @param keys Array of translation keys to find in the codebase
   * @returns Map of keys to their context information
   */
  async extractContextForKeys(keys: string[]): Promise<Map<string, IKeyContext>> {
    logger.info(`Extracting context for ${keys.length} keys from ${this.basePath}`);

    // Find all files matching the include patterns and not matching exclude patterns
    const files = await glob(this.options.includePatterns!, {
      cwd: this.basePath,
      ignore: this.options.excludePatterns,
    });

    logger.info(`Found ${files.length} files to search for context`);

    const keyContexts = new Map<string, IKeyContext>();

    // Initialize context objects for each key
    for (const key of keys) {
      keyContexts.set(key, { key, contexts: [] });
    }

    // Process each file
    for (const file of files) {
      try {
        const filePath = path.join(this.basePath, file);
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        // Check each key against the file content
        for (const key of keys) {
          // Escape special characters in the key for regex
          const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const keyRegex = new RegExp(`${escapedKey}`);

          // Search for the key in each line
          for (let i = 0; i < lines.length; i++) {
            if (keyRegex.test(lines[i])) {
              // Key found, extract context
              const contextStart = Math.max(0, i - this.options.contextLines!);
              const contextEnd = Math.min(lines.length - 1, i + this.options.contextLines!);
              const contextLines = lines.slice(contextStart, contextEnd + 1);
              const context = contextLines.join('\n');

              // Add context to the key's context list
              const keyContext = keyContexts.get(key);
              if (keyContext) {
                keyContext.contexts.push({
                  file,
                  lineNumber: i + 1,
                  context,
                });
              }
            }
          }
        }
      } catch (error) {
        logger.warn(`Error processing file ${file}: ${error}`);
      }
    }

    // Log statistics
    let totalContextsFound = 0;
    let keysWithContext = 0;

    for (const keyContext of keyContexts.values()) {
      const contextCount = keyContext.contexts.length;
      totalContextsFound += contextCount;

      if (contextCount > 0) {
        keysWithContext++;
      }
    }

    logger.info(`Found ${totalContextsFound} contexts for ${keysWithContext}/${keys.length} keys`);

    return keyContexts;
  }

  /**
   * Format extracted context information into a string
   * @param keyContexts Map of keys to their context information
   * @param maxContextsPerKey Maximum number of contexts to include per key
   * @returns Formatted context string
   */
  formatContextString(keyContexts: Map<string, IKeyContext>, maxContextsPerKey = 3): string {
    const contextDescriptions: string[] = [];

    for (const keyContext of keyContexts.values()) {
      if (keyContext.contexts.length > 0) {
        // Limit the number of contexts per key
        const exampleContexts = keyContext.contexts.slice(0, maxContextsPerKey);

        const contextDescription = `Key "${keyContext.key}" is used in:\n` +
          exampleContexts.map((ctx) =>
            `- ${ctx.file}:${ctx.lineNumber}\n  ${ctx.context.replace(/\n/g, '\n  ')}`
          ).join('\n');

        contextDescriptions.push(contextDescription);
      } else {
        contextDescriptions.push(`Key "${keyContext.key}" - no usage context found`);
      }
    }

    return contextDescriptions.join('\n\n');
  }
}