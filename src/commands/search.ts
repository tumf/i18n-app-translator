import { createVectorDBClient } from '../utils/vectorDBClient';
import type { IVectorDBClient } from '../utils/vectorDBClient';

export interface ISearchOptions {
  query: string;
  lang: string;
  limit?: number;
}

export async function search(options: ISearchOptions): Promise<void> {
  const {
    query,
    lang,
    limit = 5,
  } = options;

  console.log(`Searching for similar translations to "${query}" in language: ${lang}...`);

  try {
    // Initialize vector DB client
    console.log('Initializing vector DB client...');
    const vectorDBClient: IVectorDBClient = createVectorDBClient();
    await vectorDBClient.initialize();
    console.log('Vector DB client initialized');
    
    // Search for similar translations
    console.log('Searching...');
    const results = await vectorDBClient.findSimilarTranslations(
      query,
      lang,
      limit
    );
    
    // Display results
    console.log(`Found ${results.length} similar translations:`);
    
    if (results.length === 0) {
      console.log('No similar translations found.');
    } else {
      console.log('\n');
      
      results.forEach((result, index) => {
        const similarityPercentage = Math.round(result.similarity * 100);
        console.log(`${index + 1}. Similarity: ${similarityPercentage}%`);
        console.log(`   Source: "${result.source}"`);
        console.log(`   Translation: "${result.translation}"`);
        console.log('');
      });
    }
    
    // Close vector DB client
    await vectorDBClient.close();
  } catch (error) {
    console.error(`Error searching for translations: ${error}`);
    process.exit(1);
  }
}

export default search;