import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

describe('E2E Integration Tests with Chroma and OpenRouter', () => {
  let tempDir: string;

  beforeAll(() => {
    process.env.CI = '';
    console.log('Running E2E integration tests locally');

    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY environment variable is not set');
    }

    process.env.LLM_PROVIDER = 'openrouter';

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-app-translator-integration-e2e-'));
    
    fs.mkdirSync(path.join(tempDir, 'src'));
    fs.mkdirSync(path.join(tempDir, 'src', 'components'));

    const sampleComponent = `
import React from 'react';
import { useTranslation } from 'react-i18next';

export const Button = () => {
  const { t } = useTranslation();

  return (
    <div>
      <button>{t('common.button.submit')}</button>
      <button>{t('common.button.cancel')}</button>
      <p>{t('common.message.welcome')}</p>
    </div>
  );
};
`;
    fs.writeFileSync(path.join(tempDir, 'src', 'components', 'Button.jsx'), sampleComponent);

    const sampleEnglish = {
      'common.button.submit': 'Submit',
      'common.button.cancel': 'Cancel',
      'common.message.welcome': 'Welcome to our application',
    };
    fs.writeFileSync(path.join(tempDir, 'en.json'), JSON.stringify(sampleEnglish, null, 2));

    process.env.CHROMA_URL = path.join(tempDir, 'chroma-db');
    process.env.CHROMA_COLLECTION = 'test-translations-e2e';
  });

  afterAll(() => {

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('Full workflow with Chroma and OpenRouter: build-vector -> translate -> review', () => {
    console.log('Running E2E test locally');

    try {
      console.log('Building vector database...');
      execSync(
        `node dist/index.js build-vector --source ${path.join(tempDir, 'en.json')} --context ${path.join(tempDir, 'src')} --target ${path.join(tempDir, 'vector-db')}`,
        {
          stdio: 'pipe',
          env: {
            ...process.env,
            CHROMA_URL: process.env.CHROMA_URL,
            CHROMA_COLLECTION: process.env.CHROMA_COLLECTION,
            LLM_PROVIDER: 'openrouter',
            OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
          },
        },
      );

      console.log('Translating to Japanese...');
      execSync(
        `node dist/index.js translate --lang ja --source ${path.join(tempDir, 'en.json')} --dest ${path.join(tempDir, 'ja.json')}`,
        {
          stdio: 'pipe',
          env: {
            ...process.env,
            CHROMA_URL: process.env.CHROMA_URL,
            CHROMA_COLLECTION: process.env.CHROMA_COLLECTION,
            LLM_PROVIDER: 'openrouter',
            OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
          },
        },
      );

      expect(fs.existsSync(path.join(tempDir, 'ja.json'))).toBe(true);

      const translatedContent = JSON.parse(fs.readFileSync(path.join(tempDir, 'ja.json'), 'utf-8'));
      
      expect(translatedContent['common.button.submit']).toBeTruthy();
      expect(translatedContent['common.button.cancel']).toBeTruthy();
      expect(translatedContent['common.message.welcome']).toBeTruthy();
      
      const allTranslations = Object.values(translatedContent).join(' ');
      expect(/[あ-んア-ン]/.test(allTranslations)).toBe(true); // Contains hiragana or katakana

      console.log('Reviewing translations...');
      execSync(
        `node dist/index.js review --source ${path.join(tempDir, 'en.json')} --dest ${path.join(tempDir, 'ja.json')} --lang ja`,
        {
          stdio: 'pipe',
          env: {
            ...process.env,
            CHROMA_URL: process.env.CHROMA_URL,
            CHROMA_COLLECTION: process.env.CHROMA_COLLECTION,
            LLM_PROVIDER: 'openrouter',
            OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
          },
        },
      );

      console.log('Searching for translations...');
      const searchResult = execSync(
        `node dist/index.js search "welcome" --lang ja --limit 1`,
        {
          stdio: 'pipe',
          encoding: 'utf-8',
          env: {
            ...process.env,
            CHROMA_URL: process.env.CHROMA_URL,
            CHROMA_COLLECTION: process.env.CHROMA_COLLECTION,
            LLM_PROVIDER: 'openrouter',
            OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
          },
        },
      );

      expect(searchResult).toContain('Results for');

    } catch (error) {
      console.error('E2E integration test failed:', error);
      throw error;
    }
  }, 60000); // Increase timeout for API calls
});
