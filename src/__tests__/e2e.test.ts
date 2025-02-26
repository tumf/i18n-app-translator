import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('End-to-End Tests', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-app-translator-e2e-'));
  const exampleDir = path.join(process.cwd(), 'examples');

  beforeAll(() => {
    // Copy example files to temp directory
    fs.copyFileSync(path.join(exampleDir, 'en.json'), path.join(tempDir, 'en.json'));

    if (fs.existsSync(path.join(exampleDir, 'glossary.json'))) {
      fs.copyFileSync(path.join(exampleDir, 'glossary.json'), path.join(tempDir, 'glossary.json'));
    }

    // Create a mock source code directory for context
    const srcDir = path.join(tempDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    // Create a sample React component file
    const componentContent = `
      import React from 'react';
      
      export const Button = ({ label, onClick }) => {
        return (
          <button 
            className="primary-button" 
            onClick={onClick}
            aria-label={label}
          >
            {label}
          </button>
        );
      };
    `;

    fs.writeFileSync(path.join(srcDir, 'Button.jsx'), componentContent);
  });

  afterAll(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('Full workflow: build-vector -> translate -> review -> search', () => {
    // Skip actual API calls in CI environment
    if (process.env.CI) {
      console.log('Skipping E2E tests in CI environment');
      return;
    }

    try {
      // Build vector database
      execSync(
        `node dist/index.js build-vector --source ${path.join(tempDir, 'en.json')} --context ${path.join(tempDir, 'src')}`,
        {
          stdio: 'pipe',
        },
      );

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
      execSync(`node dist/index.js review --lang ja --file ${path.join(tempDir, 'ja.json')}`, {
        stdio: 'pipe',
      });

      // Search for a term
      const searchResult = execSync(`node dist/index.js search "button" --lang ja --top-k 3`, {
        stdio: 'pipe',
        encoding: 'utf-8',
      });

      // Verify search returns results
      expect(searchResult).toContain('Results for');
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
      execSync(`node dist/index.js import --lang ja --file ${path.join(tempDir, 'ja.json')}`, {
        stdio: 'pipe',
      });

      // Search for imported term
      const searchResult = execSync(`node dist/index.js search "cancel" --lang ja --top-k 1`, {
        stdio: 'pipe',
        encoding: 'utf-8',
      });

      // Verify search returns the imported translation
      expect(searchResult).toContain('キャンセル');
    } catch (error) {
      console.error('Import test failed:', error);
      throw error;
    }
  });
});
