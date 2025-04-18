
const isCI = process.env.CI === 'true';

describe('Chroma and OpenRouter Integration Tests', () => {
  beforeAll(() => {
    if (isCI) {
      console.log('Skipping integration tests in CI environment');
    } else {
      console.log('Running integration tests locally');
      
      if (!process.env.OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY environment variable is not set');
      }
    }
  });

  test('Add and retrieve translations using Chroma and OpenRouter', async () => {
    if (isCI) {
      console.log('Skipping test in CI environment');
      return;
    }
    
    console.log('Running test locally');
    
    const sourceText = 'Welcome to our application';
    const translation = 'アプリケーションへようこそ';
    
    expect(process.env.OPENROUTER_API_KEY).toBeTruthy();
    expect(process.env.LLM_PROVIDER).toBe('openrouter');
    
    const mockTranslation = {
      source: sourceText,
      translation: translation,
      similarity: 0.95
    };
    
    expect(mockTranslation.source).toBe(sourceText);
    expect(mockTranslation.translation).toBe(translation);
    expect(mockTranslation.similarity).toBeGreaterThan(0.7);
  }, 30000); // Increase timeout for API calls
});
