import { jest } from '@jest/globals';
import type { IVectorDBOptions } from '../../utils/vectorDBClient';
import {
  WeaviateVectorDBClient,
  PineconeVectorDBClient,
  createVectorDBClient,
} from '../../utils/vectorDBClient';

// Mock external dependencies
jest.mock('weaviate-ts-client', () => {
  const mockClient = {
    schema: {
      getter: jest.fn().mockReturnValue({
        do: jest.fn().mockImplementation(() => Promise.resolve({ classes: [] })),
      }),
      classCreator: jest.fn().mockReturnValue({
        withClass: jest.fn().mockReturnThis(),
        do: jest.fn().mockImplementation(() => Promise.resolve({})),
      }),
    },
    data: {
      creator: jest.fn().mockReturnValue({
        withClassName: jest.fn().mockReturnThis(),
        withProperties: jest.fn().mockReturnThis(),
        do: jest.fn().mockImplementation(() => Promise.resolve({})),
      }),
    },
    graphql: {
      get: jest.fn().mockReturnValue({
        withClassName: jest.fn().mockReturnThis(),
        withFields: jest.fn().mockReturnThis(),
        withNearVector: jest.fn().mockReturnThis(),
        withWhere: jest.fn().mockReturnThis(),
        withLimit: jest.fn().mockReturnThis(),
        do: jest.fn().mockImplementation(() =>
          Promise.resolve({
            data: {
              Get: {
                Translation: [
                  {
                    sourceText: 'Hello',
                    translation: 'こんにちは',
                    _additional: { certainty: 0.95 },
                  },
                ],
              },
            },
          }),
        ),
      }),
    },
  };

  return {
    client: jest.fn().mockReturnValue(mockClient),
    ApiKey: jest.fn().mockImplementation((key) => key),
  };
});

jest.mock('@pinecone-database/pinecone', () => {
  const mockIndex = {
    describeIndexStats: jest.fn().mockImplementation(() => Promise.resolve({})),
    upsert: jest.fn().mockImplementation(() => Promise.resolve({})),
    query: jest.fn().mockImplementation(() =>
      Promise.resolve({
        matches: [
          {
            metadata: {
              sourceText: 'Hello',
              translation: 'こんにちは',
            },
            score: 0.95,
          },
        ],
      }),
    ),
  };

  return {
    Pinecone: jest.fn().mockImplementation(() => ({
      index: jest.fn().mockReturnValue(mockIndex),
    })),
  };
});

// Mock Vercel AI SDK
jest.mock('ai', () => {
  return {
    embed: jest.fn().mockImplementation(() =>
      Promise.resolve({
        embedding: [0.1, 0.2, 0.3],
      }),
    ),
  };
});

// Mock OpenAI provider from Vercel AI SDK
jest.mock('@ai-sdk/openai', () => {
  return {
    openai: {
      embedding: jest.fn().mockReturnValue('mocked-embedding-model'),
    },
  };
});

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('createVectorDBClient', () => {
  test('should create WeaviateVectorDBClient when WEAVIATE_URL is set', () => {
    // Setup
    process.env.WEAVIATE_URL = 'https://example.weaviate.network';

    // Execute
    const client = createVectorDBClient();

    // Verify
    expect(client).toBeInstanceOf(WeaviateVectorDBClient);
  });

  test('should create PineconeVectorDBClient when PINECONE_API_KEY is set', () => {
    // Setup
    process.env.WEAVIATE_URL = undefined;
    process.env.PINECONE_API_KEY = 'test-api-key';

    // Execute
    const client = createVectorDBClient();

    // Verify
    expect(client).toBeInstanceOf(PineconeVectorDBClient);
  });

  test('should create WeaviateVectorDBClient with provided options', () => {
    // Setup
    const options: IVectorDBOptions = {
      url: 'https://custom.weaviate.network',
      apiKey: 'custom-api-key',
    };

    // Execute
    const client = createVectorDBClient(options);

    // Verify
    expect(client).toBeInstanceOf(WeaviateVectorDBClient);
    expect(process.env.WEAVIATE_URL).toBe(options.url);
    expect(process.env.WEAVIATE_API_KEY).toBe(options.apiKey);
  });

  test('should create PineconeVectorDBClient with provided options and indexName', () => {
    // Setup
    const options: IVectorDBOptions = {
      apiKey: 'custom-pinecone-key',
      indexName: 'custom-index',
    };
    process.env.WEAVIATE_URL = undefined;

    // Execute
    const client = createVectorDBClient(options);

    // Verify
    expect(client).toBeInstanceOf(PineconeVectorDBClient);
    expect(process.env.PINECONE_API_KEY).toBe(options.apiKey);
  });

  test('should throw error when no vector database configuration is found', () => {
    // Setup
    process.env.WEAVIATE_URL = undefined;
    process.env.PINECONE_API_KEY = undefined;

    // Execute & Verify
    expect(() => createVectorDBClient()).toThrow('No vector database configuration found');
  });
});

describe('WeaviateVectorDBClient', () => {
  let client: WeaviateVectorDBClient;

  beforeEach(() => {
    process.env.WEAVIATE_URL = 'https://example.weaviate.network';
    process.env.WEAVIATE_API_KEY = 'test-api-key';
    client = new WeaviateVectorDBClient();
  });

  test('should initialize client with environment variables', async () => {
    // Execute
    await client.initialize();

    // Verify
    // Using import from jest mock instead of require
    const weaviateModule = jest.requireMock('weaviate-ts-client') as any;
    expect(weaviateModule.client).toHaveBeenCalledWith({
      scheme: 'https',
      host: 'https://example.weaviate.network',
      apiKey: new weaviateModule.ApiKey('test-api-key'),
    });
  });

  test('should throw error when WEAVIATE_URL is not set', async () => {
    // Setup
    process.env.WEAVIATE_URL = undefined;
    client = new WeaviateVectorDBClient();

    // Execute & Verify
    await expect(client.initialize()).rejects.toThrow(
      'WEAVIATE_URL environment variable is not set',
    );
  });

  test('should create schema if it does not exist', async () => {
    // Execute
    await client.initialize();

    // Verify
    const weaviateModule = jest.requireMock('weaviate-ts-client') as any;
    const mockClient = weaviateModule.client();
    expect(mockClient.schema.getter().do).toHaveBeenCalled();
    expect(mockClient.schema.classCreator().withClass).toHaveBeenCalled();
    expect(mockClient.schema.classCreator().withClass().do).toHaveBeenCalled();
  });

  test('should not create schema if it already exists', async () => {
    // Setup
    const weaviateModule = jest.requireMock('weaviate-ts-client') as any;
    const mockGetter = weaviateModule.client().schema.getter();
    mockGetter.do.mockResolvedValueOnce({
      classes: [{ class: 'Translation' }],
    } as any);

    // Execute
    await client.initialize();

    // Verify
    expect(mockGetter.do).toHaveBeenCalled();
    expect(weaviateModule.client().schema.classCreator).not.toHaveBeenCalled();
  });

  test('should add translation', async () => {
    // Setup
    await client.initialize();

    // Execute
    await client.addTranslation('Hello', 'こんにちは', 'ja', 'greeting');

    // Verify
    const weaviateModule = jest.requireMock('weaviate-ts-client') as any;
    const mockCreator = weaviateModule.client().data.creator();
    expect(mockCreator.withClassName).toHaveBeenCalledWith('Translation');
    expect(mockCreator.withProperties).toHaveBeenCalledWith({
      sourceText: 'Hello',
      translation: 'こんにちは',
      language: 'ja',
      context: 'greeting',
    });
    expect(mockCreator.do).toHaveBeenCalled();
  });

  test('should use "unknown" as default context when not provided', async () => {
    // Setup
    await client.initialize();

    // Execute
    await client.addTranslation('Hello', 'こんにちは', 'ja');

    // Verify
    const weaviateModule = jest.requireMock('weaviate-ts-client') as any;
    const mockCreator = weaviateModule.client().data.creator();
    expect(mockCreator.withProperties).toHaveBeenCalledWith({
      sourceText: 'Hello',
      translation: 'こんにちは',
      language: 'ja',
      context: 'unknown',
    });
  });

  test('should throw error when adding translation with uninitialized client', async () => {
    // Execute & Verify
    await expect(client.addTranslation('Hello', 'こんにちは', 'ja')).rejects.toThrow(
      'Client not initialized',
    );
  });

  test('should find similar translations', async () => {
    // Setup
    await client.initialize();

    // Execute
    const results = await client.findSimilarTranslations('Hello', 'ja', 3);

    // Verify
    const weaviateModule = jest.requireMock('weaviate-ts-client') as any;
    const mockGraphQL = weaviateModule.client().graphql.get();
    expect(mockGraphQL.withClassName).toHaveBeenCalledWith('Translation');
    expect(mockGraphQL.withFields).toHaveBeenCalledWith(
      'sourceText translation _additional { certainty }',
    );
    expect(mockGraphQL.withNearVector).toHaveBeenCalledWith({
      vector: expect.any(Array),
    });
    expect(mockGraphQL.withWhere).toHaveBeenCalledWith({
      operator: 'Equal',
      path: ['language'],
      valueString: 'ja',
    });
    expect(mockGraphQL.withLimit).toHaveBeenCalledWith(3);
    expect(mockGraphQL.do).toHaveBeenCalled();

    // Check results format
    expect(results).toEqual([
      {
        source: 'Hello',
        translation: 'こんにちは',
        similarity: 0.95,
      },
    ]);
  });

  test('should throw error when finding similar translations with uninitialized client', async () => {
    // Execute & Verify
    await expect(client.findSimilarTranslations('Hello', 'ja')).rejects.toThrow(
      'Client not initialized',
    );
  });

  test('should not throw error when closing client', async () => {
    // Execute & Verify
    await expect(client.close()).resolves.not.toThrow();
  });
});

describe('PineconeVectorDBClient', () => {
  let client: PineconeVectorDBClient;

  beforeEach(() => {
    process.env.PINECONE_API_KEY = 'test-api-key';
    process.env.PINECONE_ENVIRONMENT = 'test-environment';
    client = new PineconeVectorDBClient();
  });

  test('should initialize client with environment variables', async () => {
    // Execute
    await client.initialize();

    // Verify
    const PineconeModule = jest.requireMock('@pinecone-database/pinecone') as any;
    expect(PineconeModule.Pinecone).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
    });
  });

  test('should throw error when Pinecone environment variables are not set', async () => {
    // Setup
    process.env.PINECONE_API_KEY = undefined;
    client = new PineconeVectorDBClient();

    // Execute & Verify
    await expect(client.initialize()).rejects.toThrow('Pinecone environment variables are not set');
  });

  test('should use existing index or create a new one', async () => {
    // Setup
    process.env.PINECONE_INDEX = 'test-index';
    const PineconeModule = jest.requireMock('@pinecone-database/pinecone') as any;

    // Execute
    await client.initialize();

    // Verify
    const mockClient = PineconeModule.Pinecone.mock.results[0].value;
    expect(mockClient.index).toHaveBeenCalledWith('test-index');
    expect(mockClient.index().describeIndexStats).toHaveBeenCalled();
  });

  test('should throw error when index is not accessible', async () => {
    // Setup
    const PineconeModule = jest.requireMock('@pinecone-database/pinecone') as any;
    const mockIndex = PineconeModule.Pinecone().index();
    mockIndex.describeIndexStats.mockRejectedValueOnce(new Error('Index not found'));

    // Execute & Verify
    await expect(client.initialize()).rejects.toThrow(/Failed to access Pinecone index/);
  });

  test('should add translation', async () => {
    // Setup
    await client.initialize();

    // Execute
    await client.addTranslation('Hello', 'こんにちは', 'ja', 'greeting');

    // Verify
    const PineconeModule = jest.requireMock('@pinecone-database/pinecone') as any;
    const mockIndex = PineconeModule.Pinecone().index();
    expect(mockIndex.upsert).toHaveBeenCalledWith([
      expect.objectContaining({
        values: expect.any(Array),
        metadata: {
          sourceText: 'Hello',
          translation: 'こんにちは',
          language: 'ja',
          context: 'greeting',
        },
      }),
    ]);
  });

  test('should use "unknown" as default context when not provided', async () => {
    // Setup
    await client.initialize();

    // Execute
    await client.addTranslation('Hello', 'こんにちは', 'ja');

    // Verify
    const PineconeModule = jest.requireMock('@pinecone-database/pinecone') as any;
    const mockIndex = PineconeModule.Pinecone().index();
    expect(mockIndex.upsert).toHaveBeenCalledWith([
      expect.objectContaining({
        metadata: expect.objectContaining({
          context: 'unknown',
        }),
      }),
    ]);
  });

  test('should throw error when adding translation with uninitialized index', async () => {
    // Execute & Verify
    await expect(client.addTranslation('Hello', 'こんにちは', 'ja')).rejects.toThrow(
      'Index not initialized',
    );
  });

  test('should find similar translations', async () => {
    // Setup
    await client.initialize();

    // Execute
    const results = await client.findSimilarTranslations('Hello', 'ja', 3);

    // Verify
    const PineconeModule = jest.requireMock('@pinecone-database/pinecone') as any;
    const mockIndex = PineconeModule.Pinecone().index();
    expect(mockIndex.query).toHaveBeenCalledWith({
      vector: expect.any(Array),
      topK: 3,
      filter: {
        language: { $eq: 'ja' },
      },
      includeMetadata: true,
    });

    // Check results format
    expect(results).toEqual([
      {
        source: 'Hello',
        translation: 'こんにちは',
        similarity: 0.95,
      },
    ]);
  });

  test('should throw error when finding similar translations with uninitialized index', async () => {
    // Execute & Verify
    await expect(client.findSimilarTranslations('Hello', 'ja')).rejects.toThrow(
      'Index not initialized',
    );
  });

  test('should not throw error when closing client', async () => {
    // Execute & Verify
    await expect(client.close()).resolves.not.toThrow();
  });
});
