# i18n-app-translator: Multilingual Translation Tool for Large-Scale Translation Files

[![npm version](https://img.shields.io/npm/v/i18n-app-translator.svg)](https://www.npmjs.com/package/i18n-app-translator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/tumf/i18n-app-translator/actions/workflows/ci.yml/badge.svg)](https://github.com/tumf/i18n-app-translator/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/node/v/i18n-app-translator.svg)](https://nodejs.org)
[![npm downloads](https://img.shields.io/npm/dm/i18n-app-translator.svg)](https://www.npmjs.com/package/i18n-app-translator)
[![Coverage Status](https://coveralls.io/repos/github/tumf/i18n-app-translator/badge.svg?branch=main)](https://coveralls.io/github/tumf/i18n-app-translator?branch=main)

A CLI tool for multilingual translation of large English-based translation files (e.g., en.json).
Instead of simple word-for-word translation, it uses contextual information from the source code (buttons, headings, cautions, etc.) to request translations from LLMs.
Additionally, by leveraging vector databases, it searches for contextually similar translations from existing translations and glossaries, resulting in natural translations with minimal terminology inconsistencies.

## Key Features

- **LLM-powered translation**: Provides natural translations including context such as buttons and headings
- **Terminology consistency**: Uses glossaries and vector databases to reference and utilize past translations
- **Continued use of existing translations**: Continues translation or suggests improvements for partially translated files like ja.json
- **Multilingual support**: Handles files separated by target language such as ja.json, vi.json, th.json
- **CLI format (TypeScript)**: Designed to switch LLMs using AI SDK
- **Robust error handling**: Provides detailed error messages and appropriate exit codes
- **End-to-end testing**: Implements tests to verify the entire workflow
- **Performance optimization**: Improves processing speed with parallel batch translation
- **Progress display**: Shows translation progress in real-time
- **Logging functionality**: Detailed log output and file saving capability
- **Configuration file support**: Customization of settings via `.i18n-app-translatorrc`

## Installation

```bash
npm install -g i18n-app-translator
```

Or clone the repository and run in development mode:

```bash
git clone https://github.com/tumf/i18n-app-translator.git
cd i18n-app-translator
npm install
npm run dev
```

## Environment Setup

Copy the `.env.example` file to `.env` and set the necessary environment variables.

```bash
cp .env.example .env
```

Required environment variables:

- `OPENAI_API_KEY`: API key for OpenAI (required if using OpenAI provider)
- `OPENROUTER_API_KEY`: API key for OpenRouter (required if using OpenRouter provider)
- `LLM_PROVIDER`: Provider to use for LLM operations (openai or openrouter, default: openai)

Vector database configuration (choose one):

- For Weaviate:

  - `WEAVIATE_URL`: Weaviate URL (required for search)
  - `WEAVIATE_API_KEY`: Weaviate API key (optional)

- For Pinecone:
  - `PINECONE_API_KEY`: Pinecone API key (required for search)
  - `PINECONE_ENVIRONMENT`: Pinecone environment (required for search)
  - `PINECONE_INDEX`: Pinecone index name (optional, default: "translations")

## Configuration File

You can customize the default settings by creating a `.i18n-app-translatorrc` file.

Example configuration for Weaviate:

```json
{
  "vectorDB": {
    "enabled": true,
    "url": "your-weaviate-url",
    "apiKey": "your-weaviate-api-key",
    "namespace": "translations"
  },
  "glossary": {
    "enabled": true,
    "path": "./custom-glossary.json"
  },
  "translation": {
    "concurrency": 5,
    "showProgress": true,
    "similarTranslationsLimit": 3,
    "debug": false,
    "providerType": "openai",
    "llmProvider": "gpt-4o",
    "embeddingProvider": "text-embedding-3-small"
  },
  "logging": {
    "level": 1,
    "logToFile": true,
    "logFilePath": "./logs/i18n-app-translator.log",
    "logToConsole": true,
    "timestamp": true
  }
}
```

Example configuration for Pinecone:

```json
{
  "vectorDB": {
    "enabled": true,
    "apiKey": "your-pinecone-api-key",
    "environment": "your-pinecone-environment",
    "indexName": "your-pinecone-index",
    "namespace": "translations"
  },
  "glossary": {
    "enabled": true,
    "path": "./custom-glossary.json"
  },
  "translation": {
    "concurrency": 5,
    "showProgress": true,
    "similarTranslationsLimit": 3,
    "debug": false,
    "providerType": "openai",
    "llmProvider": "gpt-4o",
    "embeddingProvider": "text-embedding-3-small"
  },
  "logging": {
    "level": 1,
    "logToFile": true,
    "logFilePath": "./logs/i18n-app-translator.log",
    "logToConsole": true,
    "timestamp": true
  }
}
```

## Usage

You can run the tool directly using npx:

```bash
npx i18n-app-translator
```

### Translation

Translate from English translation files to other languages.

```bash
i18n-app-translator translate --lang ja --source ./locales/en.json --dest ./locales/ja.json
```

Options:

- `--no-vector-db`: Don't use vector DB
- `--no-glossary`: Don't use glossary
- `--glossary-path <path>`: Custom glossary path
- `--context <context>`: Translation context (e.g., "button labels")
- `--context-from-code <path>`: Extract usage context of translation keys from files in the specified directory
- `--concurrency <number>`: Number of parallel processes (default: 5)
- `--no-progress`: Disable progress display
- `--config-path <path>`: Custom configuration file path
- `--debug`: Show translation prompts for debugging

### Translation Review

Review existing translations and suggest improvements.

```bash
i18n-app-translator review --source ./locales/en.json --dest ./locales/ja.json --lang ja --interactive
```

Options:

- `--no-vector-db`: Don't use vector DB
- `--no-glossary`: Don't use glossary
- `--glossary-path <path>`: Custom glossary path
- `--context <context>`: Translation context
- `--all`: Review all translations (by default, only old translations)
- `--concurrency <number>`: Number of parallel processes (default: 5)
- `--no-progress`: Disable progress display
- `--config-path <path>`: Custom configuration file path

### Import Existing Translations

Import existing translation files or glossaries.

```bash
i18n-app-translator import --source ./locales/ja.json --type translations --dest ./locales/ja.json --target-language ja
```

Or import a glossary:

```bash
i18n-app-translator import --source ./glossary.json --type glossary --glossary-path ./custom-glossary.json
```

Options:

- `--format <format>`: Source file format ("json" or "csv")
- `--source-language <code>`: Source language code (default: "en")
- `--config-path <path>`: Custom configuration file path

### Build Vector Database

Build a vector database including translation context.

```bash
i18n-app-translator build-vector --source ./locales/en.json --target ./locales/ja.json --target-language ja --context ./src
```

Options:

- `--batch-size <size>`: Processing batch size (default: 50)
- `--source-language <code>`: Source language code (default: "en")
- `--concurrency <number>`: Number of parallel processes (default: 5)
- `--no-progress`: Disable progress display
- `--config-path <path>`: Custom configuration file path

### Search Translations

Search for similar translations from the vector database.

```bash
i18n-app-translator search "wallet top up" --lang ja --limit 5
```

Options:

- `--config-path <path>`: Custom configuration file path

## Error Handling

This tool implements robust error handling and provides clear error messages in situations such as:

- Missing required parameters
- File not found
- Invalid file format
- Missing environment variables
- API connection errors

Error levels are displayed in four stages:

- INFO: Information only
- WARNING: Warning (processing continues)
- ERROR: Error (processing stops)
- FATAL: Fatal error (immediate exit)

## Development

```bash
# Build
npm run build

# Run in development mode
npm run dev

# Test
npm test

# End-to-end test
npm run test:e2e

# Lint
npm run lint

# Format
npm run format
```

## License

MIT
