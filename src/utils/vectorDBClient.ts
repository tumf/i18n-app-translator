import type { WeaviateClient } from 'weaviate-ts-client';
import weaviate from 'weaviate-ts-client';
import { Pinecone } from '@pinecone-database/pinecone';
import type { PineconeRecord } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';

// Initialize OpenAI client for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Vector DB client interface
export interface IVectorDBClient {
  initialize(): Promise<void>;
  addTranslation(
    sourceText: string,
    translation: string,
    language: string,
    context?: string,
  ): Promise<void>;
  findSimilarTranslations(
    sourceText: string,
    language: string,
    limit?: number,
  ): Promise<Array<{ source: string; translation: string; similarity: number }>>;
  close(): Promise<void>;
}

// Weaviate implementation
export class WeaviateVectorDBClient implements IVectorDBClient {
  private client: WeaviateClient | null = null;
  private className = 'Translation';

  async initialize(): Promise<void> {
    if (!process.env.WEAVIATE_URL) {
      throw new Error('WEAVIATE_URL environment variable is not set');
    }

    this.client = weaviate.client({
      scheme: 'https',
      host: process.env.WEAVIATE_URL,
      apiKey: process.env.WEAVIATE_API_KEY ? 
        new weaviate.ApiKey(process.env.WEAVIATE_API_KEY) : 
        undefined,
    });

    // Check if schema exists, create if not
    const schemaRes = await this.client.schema.getter().do();
    const classExists = schemaRes.classes?.some((c) => c.class === this.className);

    if (!classExists) {
      await this.client.schema
        .classCreator()
        .withClass({
          class: this.className,
          vectorizer: 'text2vec-openai',
          properties: [
            {
              name: 'sourceText',
              dataType: ['text'],
              description: 'The original English text',
            },
            {
              name: 'translation',
              dataType: ['text'],
              description: 'The translated text',
            },
            {
              name: 'language',
              dataType: ['string'],
              description: 'The language code of the translation',
            },
            {
              name: 'context',
              dataType: ['string'],
              description: 'The context of the text (button, heading, etc.)',
            },
          ],
        })
        .do();
    }
  }

  async addTranslation(
    sourceText: string,
    translation: string,
    language: string,
    context?: string,
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    await this.client.data
      .creator()
      .withClassName(this.className)
      .withProperties({
        sourceText,
        translation,
        language,
        context: context || 'unknown',
      })
      .do();
  }

  async findSimilarTranslations(
    sourceText: string,
    language: string,
    limit = 5,
  ): Promise<Array<{ source: string; translation: string; similarity: number }>> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    // Generate embedding using OpenAI
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: sourceText,
    });
    
    const embedding = embeddingResponse.data[0].embedding;

    const result = await this.client.graphql
      .get()
      .withClassName(this.className)
      .withFields('sourceText translation _additional { certainty }')
      .withNearVector({ vector: embedding })
      .withWhere({
        operator: 'Equal',
        path: ['language'],
        valueString: language,
      })
      .withLimit(limit)
      .do();

    const translations = result.data.Get[this.className];
    
    return translations.map((item: { sourceText: string; translation: string; _additional: { certainty: number } }) => ({
      source: item.sourceText,
      translation: item.translation,
      similarity: item._additional.certainty,
    }));
  }

  async close(): Promise<void> {
    // No explicit close needed for Weaviate client
  }
}

// Pinecone implementation
export class PineconeVectorDBClient implements IVectorDBClient {
  private client: Pinecone | null = null;
  private index: ReturnType<Pinecone['index']> | null = null;
  private indexName: string;

  constructor(indexName = 'translations') {
    this.indexName = indexName;
  }

  async initialize(): Promise<void> {
    if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_ENVIRONMENT) {
      throw new Error('Pinecone environment variables are not set');
    }

    this.client = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    // Use existing index or create a new one
    const indexName = process.env.PINECONE_INDEX || this.indexName;
    
    try {
      // Try to get the index - if it doesn't exist, an error will be thrown
      this.index = this.client.index(indexName);
      await this.index.describeIndexStats(); // Test if the index is accessible
    } catch (error) {
      console.error(`Error accessing Pinecone index: ${error}`);
      throw new Error(`Failed to access Pinecone index '${indexName}'. Please create the index manually in the Pinecone console.`);
    }
  }

  async addTranslation(
    sourceText: string,
    translation: string,
    language: string,
    context?: string,
  ): Promise<void> {
    if (!this.index) {
      throw new Error('Index not initialized');
    }

    // Generate embedding using OpenAI
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: sourceText,
    });
    
    const embedding = embeddingResponse.data[0].embedding;
    
    // Create a unique ID
    const id = `${language}_${Buffer.from(sourceText).toString('base64')}`;
    
    await this.index.upsert([
      {
        id,
        values: embedding,
        metadata: {
          sourceText,
          translation,
          language,
          context: context || 'unknown',
        },
      },
    ]);
  }

  async findSimilarTranslations(
    sourceText: string,
    language: string,
    limit = 5,
  ): Promise<Array<{ source: string; translation: string; similarity: number }>> {
    if (!this.index) {
      throw new Error('Index not initialized');
    }

    // Generate embedding using OpenAI
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: sourceText,
    });
    
    const embedding = embeddingResponse.data[0].embedding;
    
    const queryResult = await this.index.query({
      vector: embedding,
      topK: limit,
      filter: {
        language: { $eq: language },
      },
      includeMetadata: true,
    });
    
    return queryResult.matches.map((match) => ({
      source: match.metadata?.sourceText as string,
      translation: match.metadata?.translation as string,
      similarity: typeof match.score === 'number' ? match.score : 0,
    }));
  }

  async close(): Promise<void> {
    // No explicit close needed for Pinecone client
  }
}

// Factory function to create the appropriate client
export function createVectorDBClient(): IVectorDBClient {
  if (process.env.WEAVIATE_URL) {
    return new WeaviateVectorDBClient();
  } else if (process.env.PINECONE_API_KEY) {
    return new PineconeVectorDBClient();
  } else {
    throw new Error('No vector database configuration found');
  }
}

export default {
  createVectorDBClient,
}; 