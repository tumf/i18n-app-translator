# i18n-app-translator: 大規模翻訳ファイル多言語化ツール

大規模な英語ベース(en.jsonなど)の翻訳ファイルを多言語化するためのCLIツールです。
単純な逐語訳ではなく、ソースコード上での利用シーン(ボタン、見出し、注意書きなど)を踏まえた文脈情報を用いてLLMに翻訳を依頼します。
さらに、ベクターデータベースを活用することで、既存の翻訳や用語集から文脈の近い翻訳を検索し、表記揺れを極力抑えた自然な翻訳を実現します。

## 主な特徴

- **LLMを利用した翻訳**: ボタンや見出し等のコンテキストを含め、自然な翻訳を実施
- **表記揺れ対策**: 用語集(グロッサリ)に加えて、ベクターデータベースで過去の翻訳を参照・活用
- **既存の翻訳ファイルを継続利用**: すでに部分的に翻訳済みの ja.json などがある場合、その続きを翻訳または改善提案を行う
- **多言語対応**: ja.json, vi.json, th.json など、対象言語ごとに分かれたファイルを扱う
- **CLI形式(TypeScript製)**: AI SDK を利用してLLMを切り替えられるように設計
- **堅牢なエラーハンドリング**: 詳細なエラーメッセージと適切な終了コードを提供
- **エンドツーエンドテスト**: 全体のワークフローを検証するテストを実装
- **パフォーマンス最適化**: 並列処理によるバッチ翻訳で処理速度を向上
- **進捗表示機能**: 翻訳処理の進捗をリアルタイムで表示
- **ログ機能**: 詳細なログ出力とファイルへの保存機能
- **設定ファイル対応**: `.i18n-app-translatorrc` による設定のカスタマイズ

## インストール

```bash
npm install -g i18n-app-translator
```

または、リポジトリをクローンして開発モードで実行:

```bash
git clone https://github.com/tumf/i18n-app-translator.git
cd i18n-app-translator
npm install
npm run dev
```

## 環境設定

`.env.example` ファイルを `.env` にコピーして、必要な環境変数を設定してください。

```bash
cp .env.example .env
```

必要な環境変数:

- `OPENAI_API_KEY`: OpenAI APIキー（翻訳機能に必要）

ベクターデータベース設定（いずれかを選択）:

- Weaviateを使用する場合:
  - `WEAVIATE_URL`: WeaviateのURL（検索機能に必要）
  - `WEAVIATE_API_KEY`: WeaviateのAPIキー（オプション）

- Pineconeを使用する場合:
  - `PINECONE_API_KEY`: PineconeのAPIキー（検索機能に必要）
  - `PINECONE_ENVIRONMENT`: Pineconeの環境設定（検索機能に必要）
  - `PINECONE_INDEX`: Pineconeのインデックス名（オプション、デフォルト: "translations"）

## 設定ファイル

`.i18n-app-translatorrc` ファイルを作成することで、デフォルト設定をカスタマイズできます。

Weaviateを使用する場合の設定例:

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
    "debug": false
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

Pineconeを使用する場合の設定例:

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
    "debug": false
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

## 使い方

### 翻訳

英語の翻訳ファイルから他言語への翻訳を行います。

```bash
i18n-app-translator translate --lang ja --source ./locales/en.json --dest ./locales/ja.json
```

オプション:

- `--no-vector-db`: ベクターDBを使用しない
- `--no-glossary`: 用語集を使用しない
- `--glossary-path <path>`: カスタム用語集のパス
- `--context <context>`: 翻訳のコンテキスト（例: "button labels"）
- `--context-from-code <path>`: 指定したディレクトリ内のファイルから翻訳キーの使用コンテキストを自動抽出する
- `--concurrency <number>`: 並列処理数（デフォルト: 5）
- `--no-progress`: 進捗表示を無効化
- `--config-path <path>`: カスタム設定ファイルのパス
- `--debug`: デバッグ用に翻訳プロンプトを表示する

### 翻訳のレビュー

既存の翻訳をレビューし、改善提案を行います。

```bash
i18n-app-translator review --source ./locales/en.json --dest ./locales/ja.json --lang ja --interactive
```

オプション:

- `--no-vector-db`: ベクターDBを使用しない
- `--no-glossary`: 用語集を使用しない
- `--glossary-path <path>`: カスタム用語集のパス
- `--context <context>`: 翻訳のコンテキスト
- `--all`: 全ての翻訳をレビュー（デフォルトでは古い翻訳のみ）
- `--concurrency <number>`: 並列処理数（デフォルト: 5）
- `--no-progress`: 進捗表示を無効化
- `--config-path <path>`: カスタム設定ファイルのパス

### 既存翻訳のインポート

既存の翻訳ファイルや用語集をインポートします。

```bash
i18n-app-translator import --source ./locales/ja.json --type translations --dest ./locales/ja.json --target-language ja
```

または用語集のインポート:

```bash
i18n-app-translator import --source ./glossary.json --type glossary --glossary-path ./custom-glossary.json
```

オプション:

- `--format <format>`: ソースファイルのフォーマット（"json" または "csv"）
- `--source-language <code>`: ソース言語コード（デフォルト: "en"）
- `--config-path <path>`: カスタム設定ファイルのパス

### ベクターデータベースの構築

翻訳のコンテキストを含めてベクターデータベースを構築します。

```bash
i18n-app-translator build-vector --source ./locales/en.json --target ./locales/ja.json --target-language ja --context ./src
```

オプション:

- `--batch-size <size>`: 処理のバッチサイズ（デフォルト: 50）
- `--source-language <code>`: ソース言語コード（デフォルト: "en"）
- `--concurrency <number>`: 並列処理数（デフォルト: 5）
- `--no-progress`: 進捗表示を無効化
- `--config-path <path>`: カスタム設定ファイルのパス

### 翻訳の検索

ベクターデータベースから類似の翻訳を検索します。

```bash
i18n-app-translator search "wallet top up" --lang ja --limit 5
```

オプション:

- `--config-path <path>`: カスタム設定ファイルのパス

## エラーハンドリング

このツールは堅牢なエラーハンドリングを実装しており、以下のような状況で明確なエラーメッセージを提供します:

- 必須パラメータの欠落
- ファイルが見つからない
- 無効なファイル形式
- 環境変数の欠落
- API接続エラー

エラーレベルは以下の4段階で表示されます:

- INFO: 情報提供のみ
- WARNING: 警告（処理は続行）
- ERROR: エラー（処理を中断）
- FATAL: 致命的なエラー（即座に終了）

## 開発

```bash
# ビルド
npm run build

# 開発モードで実行
npm run dev

# テスト
npm test

# エンドツーエンドテスト
npm run test:e2e

# リント
npm run lint

# フォーマット
npm run format
```

## ライセンス

MIT
