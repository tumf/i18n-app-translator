import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import dotenv from 'dotenv';
import { AppError, ErrorLevel } from './errorHandler';

// Load environment variables directly in this module
dotenv.config();

// Check if mock mode is enabled
const MOCK_MODE = process.env.MOCK_MODE === 'true';

// Default LLM model
const DEFAULT_LLM = 'gpt-4o';

/**
 * Get the LLM model based on the TRANSLATION_LLM environment variable or configuration
 * @returns The LLM model to use for translation
 * @throws {AppError} If the LLM provider is invalid
 */
// Import ConfigManager
import configManager from './config';

export function getLLMModel() {
  // Check for environment variable first, then config, then default
  const config = configManager.getConfig();
  const llmProvider = process.env.TRANSLATION_LLM || config.translation?.llmProvider || DEFAULT_LLM;

  try {
    return openai(llmProvider);
  } catch {
    throw new AppError(`Invalid LLM provider: ${llmProvider}. Please use a valid OpenAI model.`, {
      level: ErrorLevel.ERROR,
      exit: true,
      details: `The TRANSLATION_LLM environment variable must be set to a valid OpenAI model (e.g., ${DEFAULT_LLM}).`,
    });
  }
}

/**
 * Generate translation using Vercel AI SDK
 */
export async function generateTranslation(
  sourceText: string,
  targetLanguage: string,
  context?: string,
  similarTranslations?: Array<{ source: string; translation: string }>,
  glossary?: Record<string, string>,
  debug?: boolean,
): Promise<string> {
  // Return mock response if in mock mode
  /* istanbul ignore next */
  if (MOCK_MODE) {
    console.log(`[MOCK] Translating: "${sourceText}" to ${targetLanguage}`);
    if (context) {
      console.log(`[MOCK] Context: ${context}`);
    }
    return `[${targetLanguage}] ${sourceText}`;
  }

  // Build prompt
  let prompt = `Translate the following text from English to ${targetLanguage}:\n\n${sourceText}\n\n`;

  // Add context if available
  if (context) {
    prompt += `Context: This text is used as a ${context} in the application.\n\n`;
  }

  // Add similar translations if available
  if (similarTranslations && similarTranslations.length > 0) {
    prompt += 'Here are some similar translations for reference:\n';
    similarTranslations.forEach(({ source, translation }) => {
      prompt += `- "${source}" was translated as "${translation}"\n`;
    });
    prompt += '\n';
  }

  // Add glossary if available
  if (glossary && Object.keys(glossary).length > 0) {
    prompt += 'Please use the following glossary for consistent terminology:\n';
    Object.entries(glossary).forEach(([term, translation]) => {
      prompt += `- "${term}" should be translated as "${translation}"\n`;
    });
    prompt += '\n';
  }

  prompt += 'Provide only the translation without any additional text or explanations.';

  // Log the prompt for debugging
  if (debug) {
    console.log('=== TRANSLATION PROMPT ===');
    console.log(prompt);
    console.log('=========================');
  }

  // Call Vercel AI SDK
  /* istanbul ignore next */
  const response = await generateText({
    model: getLLMModel(),
    messages: [
      {
        role: 'system',
        content: 'You are a professional translator with expertise in localization.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
  });

  return response.text.trim() || '';
}

/**
 * Review and improve existing translation
 */
export async function reviewTranslation(
  sourceText: string,
  existingTranslation: string,
  targetLanguage: string,
  context?: string,
  glossary?: Record<string, string>,
): Promise<{ improved: string; changes: string }> {
  // Return mock response if in mock mode
  /* istanbul ignore next */
  if (MOCK_MODE) {
    console.log(
      `[MOCK] Reviewing: "${existingTranslation}" for "${sourceText}" in ${targetLanguage}`,
    );
    if (context) {
      console.log(`[MOCK] Context: ${context}`);
    }
    return {
      improved: existingTranslation,
      changes: '[MOCK] No changes needed',
    };
  }

  // Build prompt
  let prompt = `Review and improve the following translation from English to ${targetLanguage}:\n\n`;
  prompt += `Original (English): ${sourceText}\n`;
  prompt += `Current translation (${targetLanguage}): ${existingTranslation}\n\n`;

  // Add context if available
  if (context) {
    prompt += `Context: This text is used as a ${context} in the application.\n\n`;
  }

  // Add glossary if available
  if (glossary && Object.keys(glossary).length > 0) {
    prompt += 'Please use the following glossary for consistent terminology:\n';
    Object.entries(glossary).forEach(([term, translation]) => {
      prompt += `- "${term}" should be translated as "${translation}"\n`;
    });
    prompt += '\n';
  }

  prompt +=
    'If the translation is already good, return it unchanged. Otherwise, provide an improved version.\n';
  prompt += 'Format your response as follows:\n';
  prompt += 'IMPROVED: [your improved translation]\n';
  prompt += 'CHANGES: [brief explanation of changes made, or "No changes needed" if unchanged]';

  // Call Vercel AI SDK
  /* istanbul ignore next */
  const response = await generateText({
    model: getLLMModel(),
    messages: [
      {
        role: 'system',
        content: 'You are a professional translator with expertise in localization.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
  });

  const content = response.text.trim() || '';

  // Parse response
  const improvedMatch = content.match(/IMPROVED: (.*?)(?=\nCHANGES:|$)/s);
  const changesMatch = content.match(/CHANGES: (.*?)$/s);

  return {
    improved: improvedMatch?.[1]?.trim() || existingTranslation,
    changes: changesMatch?.[1]?.trim() || 'No changes provided',
  };
}

export default {
  generateTranslation,
  reviewTranslation,
};
