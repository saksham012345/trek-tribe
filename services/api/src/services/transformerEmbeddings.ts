import { pipeline, env } from '@xenova/transformers';

// Disable local model storage in production
env.allowLocalModels = false;
env.useBrowserCache = false;

let embeddingPipeline: any = null;

export class TransformerEmbeddingService {
  private static instance: TransformerEmbeddingService;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  static getInstance(): TransformerEmbeddingService {
    if (!TransformerEmbeddingService.instance) {
      TransformerEmbeddingService.instance = new TransformerEmbeddingService();
    }
    return TransformerEmbeddingService.instance;
  }

  async initialize() {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        console.log('🤖 Initializing transformer embeddings model...');
        // Use all-MiniLM-L6-v2 - lightweight and fast sentence transformer
        embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        this.isInitialized = true;
        console.log('✅ Transformer embeddings model ready');
      } catch (error: any) {
        console.error('❌ Failed to initialize transformer model:', error.message);
        throw error;
      }
    })();

    return this.initPromise;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Generate embeddings
      const output = await embeddingPipeline(text, { pooling: 'mean', normalize: true });
      
      // Convert to array
      const embedding = Array.from(output.data);
      return embedding;
    } catch (error: any) {
      console.error('Error generating transformer embedding:', error.message);
      throw error;
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const embeddings = await Promise.all(
        texts.map(text => this.generateEmbedding(text))
      );
      return embeddings;
    } catch (error: any) {
      console.error('Error generating batch embeddings:', error.message);
      throw error;
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

export const transformerEmbeddings = TransformerEmbeddingService.getInstance();
