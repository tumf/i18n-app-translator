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

## インストール

```bash
npm install -g i18n-app-translator
```

または、リポジトリをクローンして開発モードで実行:

```bash
git clone https://github.com/yourusername/i18n-app-translator.git
cd i18n-app-translator
npm install
npm run dev
```

## 環境設定

`.env.example` ファイルを `.env` にコピーして、必要な環境変数を設定してください。

```bash
cp .env.example .env
```

## 使い方

### 翻訳

```bash
i18n-app-translator translate --lang ja --source ./locales/en.json --dest ./locales/ja.json
```

### 翻訳のレビュー

```bash
i18n-app-translator review --lang ja --file ./locales/ja.json --interactive
```

### 既存翻訳のインポート

```bash
i18n-app-translator import --lang ja --file ./locales/ja.json
```

### ベクターデータベースの構築

```bash
i18n-app-translator build-vector --source ./locales/en.json --context ./src
```

### 翻訳の検索

```bash
i18n-app-translator search "wallet top up" --lang ja --top-k 5
```

## 開発

```bash
# ビルド
npm run build

# 開発モードで実行
npm run dev

# テスト
npm test

# リント
npm run lint

# フォーマット
npm run format
```

## ライセンス

ISC
