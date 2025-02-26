import { OpenAI } from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// LangChain OpenAI client can be initialized when needed
// const langchainOpenAI = new ChatOpenAI({
//   openAIApiKey: process.env.OPENAI_API_KEY,
//   modelName: 'gpt-4o',
//   temperature: 0.2,
// });

/**
 * Generate translation using OpenAI API
 */
export async function generateTranslation(
  sourceText: string,
  targetLanguage: string,
  context?: string,
  similarTranslations?: Array<{ source: string; translation: string }>,
  glossary?: Record<string, string>,
): Promise<string> {
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

  // Call OpenAI API
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are a professional translator with expertise in localization.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
  });

  return response.choices[0].message.content?.trim() || '';
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

  // Call OpenAI API
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are a professional translator with expertise in localization.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
  });

  const content = response.choices[0].message.content?.trim() || '';

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
