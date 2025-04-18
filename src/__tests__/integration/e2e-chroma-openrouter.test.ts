import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';
/* istanbul ignore file */

const isCI = process.env.CI === 'true';

describe('E2E Integration Tests with Chroma and OpenRouter', () => {
  let tempDir: string;

  beforeAll(() => {
    if (isCI) {
      console.log('Skipping E2E integration tests in CI environment');
    } else {
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
      
      const sampleJapanese = {
        'common.button.submit': '送信',
        'common.button.cancel': 'キャンセル',
        'common.message.welcome': 'アプリケーションへようこそ',
      };
      fs.writeFileSync(path.join(tempDir, 'ja.json'), JSON.stringify(sampleJapanese, null, 2));
    }
  });

  afterAll(() => {
    if (!isCI && tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('Verify OpenRouter integration for translation', () => {
    if (isCI) {
      console.log('Skipping E2E test in CI environment');
      return;
    }
    
    console.log('Running E2E test locally');
    
    try {
      expect(process.env.OPENROUTER_API_KEY).toBeTruthy();
      expect(process.env.LLM_PROVIDER).toBe('openrouter');
      
      expect(fs.existsSync(path.join(tempDir, 'en.json'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'ja.json'))).toBe(true);
      
      const englishContent = JSON.parse(fs.readFileSync(path.join(tempDir, 'en.json'), 'utf-8'));
      const japaneseContent = JSON.parse(fs.readFileSync(path.join(tempDir, 'ja.json'), 'utf-8'));
      
      expect(englishContent['common.button.submit']).toBe('Submit');
      expect(japaneseContent['common.button.submit']).toBe('送信');
      
      const allTranslations = Object.values(japaneseContent).join(' ');
      expect(/[あ-んア-ン]/.test(allTranslations)).toBe(true); // Contains hiragana or katakana
      
      console.log('Testing translation command...');
      execSync(
        `node dist/index.js translate --lang ko --source ${path.join(tempDir, 'en.json')} --dest ${path.join(tempDir, 'ko.json')}`,
        {
          stdio: 'pipe',
          encoding: 'utf-8',
          env: {
            ...process.env,
            LLM_PROVIDER: 'openrouter',
            OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
            SKIP_VECTOR_DB: 'true',
          },
        }
      );
      
      expect(fs.existsSync(path.join(tempDir, 'ko.json'))).toBe(true);
      
      const koreanContent = JSON.parse(fs.readFileSync(path.join(tempDir, 'ko.json'), 'utf-8'));
      expect(koreanContent['common.button.submit']).toBeTruthy();
      expect(koreanContent['common.button.cancel']).toBeTruthy();
      expect(koreanContent['common.message.welcome']).toBeTruthy();
      
    } catch (error) {
      console.error('E2E integration test failed:', error);
      throw error;
    }
  }, 60000); // Increase timeout for API calls
});
