# i18n-app-translator API Specification

This document describes the internal APIs and module structure of i18n-app-translator.

## Core Modules

### Parser ( `src/utils/parser.ts` )

Responsible for parsing and manipulating translation files.

```typescript
interface IParserOptions {
  sourceFile: string;
  targetFile?: string;
}

class Parser {
  constructor(options: IParserOptions);

  // Load translation files
  loadSource(): Record<string, string>;
  loadTarget(): Record<string, string>;

  // Save translation file
  saveTarget(translations: Record<string, string>): void;

  // Get untranslated keys
  getUntranslatedKeys(): string[];

  // Get outdated translations
  getOutdatedTranslations(): Record<string, { source: string; target: string }>;

  // Extract key usage context from source code
  extractKeyContext(key: string, contextDir: string): string[];
}
```

### Glossary ( `src/utils/glossary.ts` )

Manages the terminology glossary.

```typescript
interface IGlossaryEntry {
  term: string;
  translation: string;
  context?: string;
  notes?: string;
}

interface IGlossaryOptions {
  path?: string;
  language: string;
}

class Glossary {
  constructor(options: IGlossaryOptions);

  // Load glossary
  load(): IGlossaryEntry[];

  // Save glossary
  save(entries: IGlossaryEntry[]): void;

  // Add term
  addEntry(entry: IGlossaryEntry): void;

  // Find term
  findTerm(term: string): IGlossaryEntry | undefined;

  // Replace terms in a string
  applyToString(text: string): string;
}
```

### VectorDBClient ( `src/utils/vectorDBClient.ts` )

Handles integration with vector databases.

```typescript
interface IVectorDBClientOptions {
  url: string;
  apiKey?: string;
}

interface IVectorDBClient {
  // Store vector
  storeVector(
    text: string,
    translation: string,
    language: string,
    metadata?: Record<string, unknown>,
  ): Promise<string>;

  // Search similar vectors
  searchSimilar(
    text: string,
    language: string,
    limit?: number,
  ): Promise<
    Array<{ text: string; translation: string; score: number; metadata?: Record<string, unknown> }>
  >;

  // Store vectors in batch
  storeBatch(
    items: Array<{
      text: string;
      translation: string;
      language: string;
      metadata?: Record<string, unknown>;
    }>,
  ): Promise<string[]>;
}

function createVectorDBClient(options: IVectorDBClientOptions): IVectorDBClient;
```

### AIClient ( `src/utils/aiClient.ts` )

Handles integration with AI APIs.

```typescript
interface IAIClientOptions {
  apiKey: string;
  model?: string;
}

interface IAIClient {
  // Translate text
  translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    context?: string,
  ): Promise<string>;

  // Improve translation
  improveTranslation(
    sourceText: string,
    currentTranslation: string,
    targetLanguage: string,
    context?: string,
  ): Promise<string>;

  // Check translation consistency
  checkConsistency(
    translations: Record<string, string>,
    targetLanguage: string,
  ): Promise<Record<string, string>>;
}

function createAIClient(options: IAIClientOptions): IAIClient;
```

### Translator ( `src/utils/translator.ts` )

Manages the overall translation process.

```typescript
interface ITranslatorOptions {
  sourceLanguage: string;
  targetLanguage: string;
  useVectorDB?: boolean;
  useGlossary?: boolean;
  glossaryPath?: string;
  context?: string;
}

class Translator {
  constructor(options: ITranslatorOptions);

  // Translate text
  translateText(text: string, key?: string): Promise<string>;

  // Translate entire file
  translateFile(sourcePath: string, targetPath: string): Promise<void>;

  // Improve translation
  improveTranslation(sourceText: string, currentTranslation: string, key?: string): Promise<string>;

  // Review translation file
  reviewFile(
    sourcePath: string,
    targetPath: string,
    all?: boolean,
  ): Promise<Record<string, { original: string; improved: string }>>;
}
```

## Command Modules

### translate ( `src/commands/translate.ts` )

```typescript
interface ITranslateOptions {
  source: string;
  dest: string;
  lang: string;
  useVectorDB?: boolean;
  useGlossary?: boolean;
  glossaryPath?: string;
  context?: string;
}

function translate(options: ITranslateOptions): Promise<void>;
```

### review ( `src/commands/review.ts` )

```typescript
interface IReviewOptions {
  source: string;
  dest: string;
  lang: string;
  useVectorDB?: boolean;
  useGlossary?: boolean;
  glossaryPath?: string;
  context?: string;
  all?: boolean;
}

function review(options: IReviewOptions): Promise<void>;
```

### import ( `src/commands/import.ts` )

```typescript
interface IImportOptions {
  source: string;
  type: 'glossary' | 'translations';
  dest?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  glossaryPath?: string;
  format?: 'json' | 'csv';
}

function importData(options: IImportOptions): Promise<void>;
```

### build-vector ( `src/commands/build-vector.ts` )

```typescript
interface IBuildVectorOptions {
  source: string;
  target: string;
  sourceLanguage?: string;
  targetLanguage: string;
  context?: string;
  batchSize?: number;
}

function buildVector(options: IBuildVectorOptions): Promise<void>;
```

### search ( `src/commands/search.ts` )

```typescript
interface ISearchOptions {
  query: string;
  lang: string;
  limit?: number;
}

function search(options: ISearchOptions): Promise<void>;
```

## Error Handling

### ErrorHandler ( `src/utils/errorHandler.ts` )

```typescript
enum ErrorLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  FATAL = 'fatal',
}

interface IErrorOptions {
  level?: ErrorLevel;
  exit?: boolean;
  code?: number;
  details?: unknown;
}

class AppError extends Error {
  level: ErrorLevel;
  exit: boolean;
  code: number;
  details?: unknown;

  constructor(message: string, options?: IErrorOptions);
}

function handleError(error: unknown): void;

function validateRequiredParams(params: Record<string, unknown>, requiredParams: string[]): void;

function validateFileExists(filePath: string, fileType: string): void;

function validateFileFormat(filePath: string, expectedFormat: string): void;

function validateEnvironmentVars(requiredVars: string[]): void;
```

## CLI Entry Point

### index.ts ( `src/index.ts` )

The entry point for the command line interface. Uses Commander.js to define CLI commands and calls each command module.

```typescript
// CLI configuration
program
  .name('i18n-app-translator')
  .description('CLI for multi-language i18n with LLM & Vector DB')
  .version('1.0.0');

// Register each command
// translate, review, import, build-vector, search

// Global error handling
process.on('uncaughtException', handleError);
process.on('unhandledRejection', handleError);
```
