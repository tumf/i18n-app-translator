import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

describe('End-to-End Tests', () => {
  let tempDir: string;

  beforeAll(() => {
    // Create a temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-app-translator-e2e-'));

    // Create a sample source directory structure
    fs.mkdirSync(path.join(tempDir, 'src'));
    fs.mkdirSync(path.join(tempDir, 'src', 'components'));

    // Create a sample React component file
    const sampleComponent = `
import React from 'react';
import { useTranslation } from 'react-i18next';

export const Button = () => {
  const { t } = useTranslation();

  return (
    <div>
      <button>{t('common.button.submit')}</button>
      <button>{t('common.button.cancel')}</button>
    </div>
  );
};
`;
    fs.writeFileSync(path.join(tempDir, 'src', 'components', 'Button.jsx'), sampleComponent);

    // Create a sample en.json file
    const sampleEnglish = {
      'common.button.submit': 'Submit',
      'common.button.cancel': 'Cancel',
    };
    fs.writeFileSync(path.join(tempDir, 'en.json'), JSON.stringify(sampleEnglish, null, 2));
  });

  afterAll(() => {
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('Full workflow: build-vector -> translate -> review -> search', () => {
    // Skip actual API calls in CI environment
    if (process.env.CI) {
      console.log('Skipping E2E tests in CI environment');
      return;
    }

    try {
      // Skip build-vector test as it requires VECTOR_DB_URL
      // Build vector database
      /*
      execSync(
        `node dist/index.js build-vector --source ${path.join(tempDir, 'en.json')} --context ${path.join(tempDir, 'src')} --target ${path.join(tempDir, 'vector-db.json')} --target-language ja`,
        {
          stdio: 'pipe',
        },
      );
      */

      // Translate to Japanese
      execSync(
        `node dist/index.js translate --lang ja --source ${path.join(tempDir, 'en.json')} --dest ${path.join(tempDir, 'ja.json')}`,
        {
          stdio: 'pipe',
        },
      );

      // Verify translation file exists
      expect(fs.existsSync(path.join(tempDir, 'ja.json'))).toBe(true);

      // Review translations (non-interactive mode for testing)
      execSync(
        `node dist/index.js review --source ${path.join(tempDir, 'en.json')} --dest ${path.join(tempDir, 'ja.json')} --lang ja`,
        {
          stdio: 'pipe',
        },
      );

      // Skip search test as it requires VECTOR_DB_URL
      /*
      // Search for a term
      const searchResult = execSync(`node dist/index.js search "button" --lang ja --limit 3`, {
        stdio: 'pipe',
        encoding: 'utf-8',
      });

      // Verify search returns results
      expect(searchResult).toContain('Results for');
      */
    } catch (error) {
      console.error('E2E test failed:', error);
      throw error;
    }
  });

  test('Import command', () => {
    // Skip actual API calls in CI environment
    if (process.env.CI) {
      console.log('Skipping import test in CI environment');
      return;
    }

    try {
      // Create a sample ja.json file to import
      const sampleTranslation = {
        'common.button.submit': '送信',
        'common.button.cancel': 'キャンセル',
      };

      fs.writeFileSync(path.join(tempDir, 'ja.json'), JSON.stringify(sampleTranslation, null, 2));

      // Import translations
      execSync(
        `node dist/index.js import --type translations --source ${path.join(tempDir, 'ja.json')} --target-language ja --dest ${path.join(tempDir, 'output.json')}`,
        {
          stdio: 'pipe',
        },
      );

      // Skip search test as it requires VECTOR_DB_URL
      /*
      // Search for imported term
      const searchResult = execSync(`node dist/index.js search "cancel" --lang ja --limit 1`, {
        stdio: 'pipe',
        encoding: 'utf-8',
      });

      // Verify search returns the imported translation
      expect(searchResult).toContain('キャンセル');
      */
    } catch (error) {
      console.error('Import test failed:', error);
      throw error;
    }
  });
});
