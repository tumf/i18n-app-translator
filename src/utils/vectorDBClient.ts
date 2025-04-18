import type { WeaviateClient } from 'weaviate-ts-client';
import weaviate from 'weaviate-ts-client';
import { Pinecone } from '@pinecone-database/pinecone';
import { embed } from 'ai';
import dotenv from 'dotenv';
import { getEmbeddingModel } from './aiClient';

/* istanbul ignore next - environment-dependent code */
// Load environment variables directly in this module
dotenv.config();

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

  /* istanbul ignore next */
  async initialize(): Promise<void> {
    if (!process.env.WEAVIATE_URL) {
      throw new Error('WEAVIATE_URL environment variable is not set');
    }

    this.client = weaviate.client({
      scheme: 'https',
      host: process.env.WEAVIATE_URL,
      apiKey: process.env.WEAVIATE_API_KEY
        ? new weaviate.ApiKey(process.env.WEAVIATE_API_KEY)
        : undefined,
    });

    // Check if schema exists, create if not
    const schemaRes = await this.client.schema.getter().do();
    const classExists = schemaRes.classes?.some((c) => c.class === this.className);

    if (!classExists) {
      await this.client.schema
        .classCreator()
        .withClass({
          class: this.className,
          vectorizer: 'text2vec-openai', // cspell:ignore vectorizer
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

    /* istanbul ignore next - external API call */
    // No need to generate embedding for Weaviate as it handles this internally
    /* istanbul ignore next */

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

    /* istanbul ignore next - external API call */
    // Generate embedding using Vercel AI SDK
    /* istanbul ignore next */
    const embeddingResponse = await embed({
      model: getEmbeddingModel(), // Uses EMBEDDING_LLM environment variable or config
      value: sourceText,
    });

    const embedding = embeddingResponse.embedding;

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

    return translations.map(
      (item: { sourceText: string; translation: string; _additional: { certainty: number } }) => ({
        source: item.sourceText,
        translation: item.translation,
        similarity: item._additional.certainty,
      }),
    );
  }

  /* istanbul ignore next */
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

  /* istanbul ignore next */
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
      throw new Error(
        `Failed to access Pinecone index '${indexName}'. Please create the index manually in the Pinecone console.`,
      );
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

    /* istanbul ignore next - external API call */
    // Generate embedding using Vercel AI SDK
    /* istanbul ignore next */
    const embeddingResponse = await embed({
      model: getEmbeddingModel(), // Uses EMBEDDING_LLM environment variable or config
      value: sourceText,
    });

    const embedding = embeddingResponse.embedding;

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

    /* istanbul ignore next - external API call */
    // Generate embedding using Vercel AI SDK
    /* istanbul ignore next */
    const embeddingResponse = await embed({
      model: getEmbeddingModel(), // Uses EMBEDDING_LLM environment variable or config
      value: sourceText,
    });

    const embedding = embeddingResponse.embedding;

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

  /* istanbul ignore next */
  async close(): Promise<void> {
    // No explicit close needed for Pinecone client
  }
}

// Chroma implementation
export class ChromaVectorDBClient implements IVectorDBClient {
  private client: Record<string, any> | null = null; // ChromaClient type 
  private collection: Record<string, any> | null = null; // Collection type
  private collectionName: string;

  constructor(collectionName = 'translations') {
    this.collectionName = collectionName;
  }

  /* istanbul ignore next */
  async initialize(): Promise<void> {
    if (!process.env.CHROMA_URL) {
      throw new Error('CHROMA_URL environment variable is not set');
    }

    const { ChromaClient } = await import('chromadb');
    
    this.client = new ChromaClient({
      path: process.env.CHROMA_URL.startsWith('http') 
        ? process.env.CHROMA_URL 
        : 'http://localhost:8000',
    });

    const collectionName = process.env.CHROMA_COLLECTION || this.collectionName;
    
    try {
      this.collection = await this.client.getCollection({
        name: collectionName,
      });
    } catch {
      this.collection = await this.client.createCollection({
        name: collectionName,
      });
    }
  }

  async addTranslation(
    sourceText: string,
    translation: string,
    language: string,
    context?: string,
  ): Promise<void> {
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    /* istanbul ignore next - external API call */
    // Generate embedding using Vercel AI SDK
    const embeddingResponse = await embed({
      model: getEmbeddingModel(), // Uses EMBEDDING_LLM environment variable or config
      value: sourceText,
    });

    const embedding = embeddingResponse.embedding;

    // Create a unique ID
    const id = `${language}_${Buffer.from(sourceText).toString('base64')}`;

    await this.collection.add({
      ids: [id],
      embeddings: [embedding],
      metadatas: [{
        sourceText,
        translation,
        language,
        context: context || 'unknown',
      }],
      documents: [sourceText], // Store the original text as the document
    });
  }

  async findSimilarTranslations(
    sourceText: string,
    language: string,
    limit = 5,
  ): Promise<Array<{ source: string; translation: string; similarity: number }>> {
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    /* istanbul ignore next - external API call */
    // Generate embedding using Vercel AI SDK
    const embeddingResponse = await embed({
      model: getEmbeddingModel(), // Uses EMBEDDING_LLM environment variable or config
      value: sourceText,
    });

    const embedding = embeddingResponse.embedding;

    const queryResult = await this.collection.query({
      queryEmbeddings: [embedding],
      nResults: limit,
      where: { language: language },
    });

    // Format results to match interface
    const results: Array<{ source: string; translation: string; similarity: number }> = [];
    
    if (queryResult.metadatas && queryResult.metadatas[0]) {
      for (let i = 0; i < queryResult.metadatas[0].length; i++) {
        const metadata = queryResult.metadatas[0][i];
        const distance = queryResult.distances?.[0]?.[i] || 0;
        const similarity = 1 - distance;
        
        results.push({
          source: metadata.sourceText,
          translation: metadata.translation,
          similarity,
        });
      }
    }

    return results;
  }

  /* istanbul ignore next */
  async close(): Promise<void> {
    // No explicit close needed for Chroma client
  }
}

// Factory function to create the appropriate client
export interface IVectorDBOptions {
  url?: string;
  apiKey?: string;
  namespace?: string;
  indexName?: string;
}

/* istanbul ignore next */
export function createVectorDBClient(options: IVectorDBOptions = {}): IVectorDBClient {
  const { url, apiKey, indexName, namespace } = options;

  // Override environment variables with provided options
  const weaviateUrl = url || process.env.WEAVIATE_URL;
  const pineconeApiKey = apiKey || process.env.PINECONE_API_KEY;
  const chromaUrl = url || process.env.CHROMA_URL;
  const chromaCollection = namespace || process.env.CHROMA_COLLECTION;

  if (weaviateUrl) {
    // Set environment variables for the client
    if (url) process.env.WEAVIATE_URL = url;
    if (apiKey) process.env.WEAVIATE_API_KEY = apiKey;

    return new WeaviateVectorDBClient();
  } else if (pineconeApiKey) {
    // Set environment variables for the client
    if (apiKey) process.env.PINECONE_API_KEY = apiKey;

    return new PineconeVectorDBClient(indexName);
  } else if (chromaUrl) {
    // Set environment variables for the client
    if (url) process.env.CHROMA_URL = url;
    if (namespace) process.env.CHROMA_COLLECTION = namespace;

    return new ChromaVectorDBClient(chromaCollection);
  } else {
    throw new Error('No vector database configuration found');
  }
}

export default {
  createVectorDBClient,
};
