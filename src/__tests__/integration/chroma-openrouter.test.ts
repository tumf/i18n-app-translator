import fs from 'fs';
import path from 'path';
import os from 'os';
import { ChromaVectorDBClient } from '../../utils/vectorDBClient';

describe('Chroma and OpenRouter Integration Tests', () => {
  let tempDir: string;
  let chromaClient: ChromaVectorDBClient;

  beforeAll(async () => {
    process.env.LLM_PROVIDER = 'openrouter';
    
    if (process.env.CI) {
      console.log('Skipping integration tests in CI environment');
      return;
    }

    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY environment variable is not set');
    }

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-app-translator-integration-'));
    
    const sampleEnglish = {
      'common.button.submit': 'Submit',
      'common.button.cancel': 'Cancel',
      'common.message.welcome': 'Welcome to our application',
    };
    fs.writeFileSync(path.join(tempDir, 'en.json'), JSON.stringify(sampleEnglish, null, 2));

    process.env.CHROMA_URL = path.join(tempDir, 'chroma-db');
    process.env.CHROMA_COLLECTION = 'test-translations';
    
    chromaClient = new ChromaVectorDBClient('test-translations');
    await chromaClient.initialize();
  });

  afterAll(async () => {
    if (process.env.CI) {
      return;
    }

    if (chromaClient) {
      await chromaClient.close();
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('Add and retrieve translations using Chroma and OpenRouter', async () => {
    if (process.env.CI) {
      console.log('Skipping test in CI environment');
      return;
    }

    const sourceText = 'Welcome to our application';
    const translation = 'アプリケーションへようこそ';
    const language = 'ja';
    const context = 'greeting';

    await chromaClient.addTranslation(sourceText, translation, language, context);

    const similarTranslations = await chromaClient.findSimilarTranslations(
      'Welcome to the app',
      language,
      1
    );

    expect(similarTranslations.length).toBe(1);
    expect(similarTranslations[0].source).toBe(sourceText);
    expect(similarTranslations[0].translation).toBe(translation);
    expect(similarTranslations[0].similarity).toBeGreaterThan(0.7);
  }, 30000); // Increase timeout for API calls
});
