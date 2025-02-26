# i18n-app-translator API仕様書

このドキュメントでは、i18n-app-translatorの内部APIとモジュール構造について説明します。

## コアモジュール

### Parser ( `src/utils/parser.ts` )

翻訳ファイルの解析と操作を担当します。

```typescript
interface IParserOptions {
  sourceFile: string;
  targetFile?: string;
}

class Parser {
  constructor(options: IParserOptions);

  // 翻訳ファイルを読み込む
  loadSource(): Record<string, string>;
  loadTarget(): Record<string, string>;

  // 翻訳ファイルを保存する
  saveTarget(translations: Record<string, string>): void;

  // 未翻訳のキーを取得する
  getUntranslatedKeys(): string[];

  // 古い翻訳を取得する
  getOutdatedTranslations(): Record<string, { source: string; target: string }>;

  // ソースコードからキーの使用コンテキストを抽出する
  extractKeyContext(key: string, contextDir: string): string[];
}
```

### Glossary ( `src/utils/glossary.ts` )

用語集の管理を担当します。

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

  // 用語集を読み込む
  load(): IGlossaryEntry[];

  // 用語集を保存する
  save(entries: IGlossaryEntry[]): void;

  // 用語を追加する
  addEntry(entry: IGlossaryEntry): void;

  // 用語を検索する
  findTerm(term: string): IGlossaryEntry | undefined;

  // 文字列内の用語を置換する
  applyToString(text: string): string;
}
```

### VectorDBClient ( `src/utils/vectorDBClient.ts` )

ベクターデータベースとの連携を担当します。

```typescript
interface IVectorDBClientOptions {
  url: string;
  apiKey?: string;
}

interface IVectorDBClient {
  // ベクターを保存する
  storeVector(
    text: string,
    translation: string,
    language: string,
    metadata?: Record<string, unknown>,
  ): Promise<string>;

  // 類似のベクターを検索する
  searchSimilar(
    text: string,
    language: string,
    limit?: number,
  ): Promise<
    Array<{ text: string; translation: string; score: number; metadata?: Record<string, unknown> }>
  >;

  // バッチ処理でベクターを保存する
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

AI APIとの連携を担当します。

```typescript
interface IAIClientOptions {
  apiKey: string;
  model?: string;
}

interface IAIClient {
  // テキストを翻訳する
  translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    context?: string,
  ): Promise<string>;

  // 翻訳を改善する
  improveTranslation(
    sourceText: string,
    currentTranslation: string,
    targetLanguage: string,
    context?: string,
  ): Promise<string>;

  // 翻訳の一貫性をチェックする
  checkConsistency(
    translations: Record<string, string>,
    targetLanguage: string,
  ): Promise<Record<string, string>>;
}

function createAIClient(options: IAIClientOptions): IAIClient;
```

### Translator ( `src/utils/translator.ts` )

翻訳プロセス全体を管理します。

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

  // テキストを翻訳する
  translateText(text: string, key?: string): Promise<string>;

  // 翻訳ファイル全体を翻訳する
  translateFile(sourcePath: string, targetPath: string): Promise<void>;

  // 翻訳を改善する
  improveTranslation(sourceText: string, currentTranslation: string, key?: string): Promise<string>;

  // 翻訳ファイルをレビューする
  reviewFile(
    sourcePath: string,
    targetPath: string,
    all?: boolean,
  ): Promise<Record<string, { original: string; improved: string }>>;
}
```

## コマンドモジュール

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

## エラーハンドリング

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

## CLI エントリーポイント

### index.ts ( `src/index.ts` )

コマンドラインインターフェースのエントリーポイントです。Commander.jsを使用してCLIコマンドを定義し、各コマンドモジュールを呼び出します。

```typescript
// CLI設定
program
  .name('i18n-app-translator')
  .description('CLI for multi-language i18n with LLM & Vector DB')
  .version('1.0.0');

// 各コマンドの登録
// translate, review, import, build-vector, search

// グローバルエラーハンドリング
process.on('uncaughtException', handleError);
process.on('unhandledRejection', handleError);
```
