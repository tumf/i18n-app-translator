#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import { translate } from './commands/translate';
import { review } from './commands/review';
import { importData } from './commands/import';
import { buildVector } from './commands/build-vector';
import { search } from './commands/search';

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
  .action((options) => {
    translate({
      source: options.source,
      dest: options.dest,
      lang: options.lang,
      useVectorDB: options.vectorDb !== false,
      useGlossary: options.glossary !== false,
      glossaryPath: options.glossaryPath,
      context: options.context,
    });
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
  .option('--all', 'Review all translations, not just outdated ones')
  .action((options) => {
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
    importData({
      source: options.source,
      type: options.type,
      dest: options.dest,
      sourceLanguage: options.sourceLanguage,
      targetLanguage: options.targetLanguage,
      glossaryPath: options.glossaryPath,
      format: options.format,
    });
  });

// Register build-vector command
program
  .command('build-vector')
  .description('Build vector database from existing translations')
  .requiredOption('--source <path>', 'Source JSON (e.g. en.json)')
  .requiredOption('--target <path>', 'Target JSON (e.g. ja.json)')
  .requiredOption('--target-language <code>', 'Target language code')
  .option('--context <context>', 'Context for translations')
  .option('--batch-size <size>', 'Batch size for processing', '50')
  .action((options) => {
    buildVector({
      source: options.source,
      target: options.target,
      targetLanguage: options.targetLanguage,
      context: options.context,
      batchSize: parseInt(options.batchSize, 10),
    });
  });

// Register search command
program
  .command('search')
  .description('Search for similar translations in vector database')
  .requiredOption('--query <text>', 'Text to search for')
  .requiredOption('--lang <code>', 'Language code to search in')
  .option('--limit <count>', 'Maximum number of results', '5')
  .action((options) => {
    search({
      query: options.query,
      lang: options.lang,
      limit: parseInt(options.limit, 10),
    });
  });

// Parse arguments
program.parse(process.argv);

// If no arguments, show help
if (process.argv.length <= 2) {
  program.help();
}