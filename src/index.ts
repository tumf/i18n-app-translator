#!/usr/bin/env node

/* istanbul ignore file */
import { Command } from 'commander';
import dotenv from 'dotenv';
import { translate } from './commands/translate';
import { review } from './commands/review';
import { importData } from './commands/import';
import { buildVector } from './commands/build-vector';
import { search } from './commands/search';
import { handleError, validateEnvironmentVars } from './utils/errorHandler';

// Load environment variables
dotenv.config();

// Initialize CLI
const program = new Command();

program
  .name('i18n-app-translator')
  .description('CLI for multi-language i18n with LLM & Vector DB')
  .version('1.0.0');

// Register translate command
program
  .command('translate')
  .description('Translate new or updated keys using LLM')
  .requiredOption('--source <path>', 'Source JSON (e.g. en.json)')
  .requiredOption('--dest <path>', 'Destination JSON (e.g. ja.json)')
  .requiredOption('--lang <lang>', 'Target language code (e.g. ja, fr, es)')
  .option('--no-vector-db', 'Disable vector DB usage')
  .option('--no-glossary', 'Disable glossary usage')
  .option('--glossary-path <path>', 'Custom glossary path')
  .option('--context <context>', 'Context for translations (e.g. "button labels")')
  .option(
    '--context-from-code <path>',
    'Extract context automatically from files in the specified directory',
  )
  .option('--concurrency <number>', 'Number of concurrent translations', '5')
  .option('--no-progress', 'Disable progress display')
  .option('--config-path <path>', 'Custom config file path')
  .option('--debug', 'Enable debug mode to show translation prompts')
  .action((options) => {
    try {
      // Validate environment variables if using AI services
      validateEnvironmentVars(['OPENAI_API_KEY']);

      translate({
        source: options.source,
        dest: options.dest,
        lang: options.lang,
        useVectorDB: options.vectorDb !== false,
        useGlossary: options.glossary !== false,
        glossaryPath: options.glossaryPath,
        context: options.context,
        contextFromCode: options.contextFromCode,
        concurrency: parseInt(options.concurrency, 10),
        showProgress: options.progress !== false,
        configPath: options.configPath,
        debug: options.debug || false,
      });
    } catch (error) {
      handleError(error);
    }
  });

// Register review command
program
  .command('review')
  .description('Review and improve existing translations')
  .requiredOption('--source <path>', 'Source JSON (e.g. en.json)')
  .requiredOption('--dest <path>', 'Destination JSON (e.g. ja.json)')
  .requiredOption('--lang <lang>', 'Target language code (e.g. ja, fr, es)')
  .option('--no-vector-db', 'Disable vector DB usage')
  .option('--no-glossary', 'Disable glossary usage')
  .option('--glossary-path <path>', 'Custom glossary path')
  .option('--context <context>', 'Context for translations (e.g. "button labels")')
  .option('--interactive', 'Enable interactive mode')
  .option('--all', 'Review all translations, not just outdated ones')
  .action((options) => {
    try {
      // Validate environment variables if using AI services
      validateEnvironmentVars(['OPENAI_API_KEY']);

      review({
        source: options.source,
        dest: options.dest,
        lang: options.lang,
        useVectorDB: options.vectorDb !== false,
        useGlossary: options.glossary !== false,
        glossaryPath: options.glossaryPath,
        context: options.context,
        all: options.all,
      });
    } catch (error) {
      handleError(error);
    }
  });

// Register import command
program
  .command('import')
  .description('Import translations or glossary entries from external sources')
  .requiredOption('--source <path>', 'Source file to import from')
  .requiredOption('--type <type>', 'Type of import: "glossary" or "translations"')
  .option('--dest <path>', 'Destination file (required for translations)')
  .option('--source-language <code>', 'Source language code', 'en')
  .option('--target-language <code>', 'Target language code')
  .option('--glossary-path <path>', 'Custom glossary path')
  .option('--format <format>', 'Format of the source file: "json" or "csv"', 'json')
  .action((options) => {
    try {
      importData({
        source: options.source,
        type: options.type as 'glossary' | 'translations',
        dest: options.dest,
        sourceLanguage: options.sourceLanguage,
        targetLanguage: options.targetLanguage,
        glossaryPath: options.glossaryPath,
        format: options.format as 'json' | 'csv',
      });
    } catch (error) {
      handleError(error);
    }
  });

// Register build-vector command
program
  .command('build-vector')
  .description('Build vector database from existing translations')
  .requiredOption('--source <path>', 'Source JSON (e.g. en.json)')
  .requiredOption('--target <path>', 'Target JSON (e.g. ja.json)')
  .requiredOption('--target-language <code>', 'Target language code')
  .option('--source-language <code>', 'Source language code', 'en')
  .option('--context <path>', 'Source code context directory')
  .option('--batch-size <size>', 'Batch size for processing', '50')
  .action((options) => {
    try {
      // Validate environment variables for vector DB
      validateEnvironmentVars(['OPENAI_API_KEY', 'VECTOR_DB_URL']);

      buildVector({
        source: options.source,
        target: options.target,
        targetLanguage: options.targetLanguage,
        sourceLanguage: options.sourceLanguage,
        context: options.context,
        batchSize: parseInt(options.batchSize, 10),
      });
    } catch (error) {
      handleError(error);
    }
  });

// Register search command
program
  .command('search')
  .description('Search for similar translations in vector database')
  .argument('<query>', 'Text to search for')
  .requiredOption('--lang <code>', 'Language code to search in')
  .option('--limit <count>', 'Maximum number of results', '5')
  .action((query, options) => {
    try {
      // Validate environment variables for vector DB
      validateEnvironmentVars(['VECTOR_DB_URL']);

      search({
        query,
        lang: options.lang,
        limit: parseInt(options.limit, 10),
      });
    } catch (error) {
      handleError(error);
    }
  });

// Parse arguments
program.parse(process.argv);

// If no arguments, show help
if (process.argv.length <= 2) {
  program.help();
}

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  handleError(error);
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  handleError(reason);
});
