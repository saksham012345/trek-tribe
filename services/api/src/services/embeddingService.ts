import OpenAI from 'openai';

interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
  tokens?: number;
}

interface EmbeddingBatch {
  embeddings: number[][];
  totalTokens: number;
}

export class EmbeddingService {
  private openai?: OpenAI;
  private ready: boolean = false;
  private model: string = 'text-embedding-3-small';
  private dimensions: number = 1536;
  
  // TF-IDF fallback cache
  private tfidfVocabulary: Map<string, number> = new Map();
  private documentFrequency: Map<string, number> = new Map();
  private totalDocuments: number = 0;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      
      if (apiKey) {
        this.openai = new OpenAI({ apiKey });
        
        // Test the connection
        await this.testConnection();
        this.ready = true;
        console.log('✅ OpenAI Embedding Service initialized successfully');
      } else {
        console.warn('⚠️ OpenAI API key not found. Using local TF-IDF fallback.');
        this.initializeTFIDFFallback();
      }
    } catch (error: any) {
      console.error('❌ Failed to initialize OpenAI Embedding Service:', error.message);
      console.log('🔄 Falling back to local TF-IDF embeddings');
      this.initializeTFIDFFallback();
    }
  }

  private async testConnection() {
    if (!this.openai) throw new Error('OpenAI not initialized');
    
    await this.openai.embeddings.create({
      model: this.model,
      input: "test",
      dimensions: this.dimensions
    });
  }

  private initializeTFIDFFallback() {
    this.ready = true; // Set ready for TF-IDF fallback
    console.log('📊 TF-IDF fallback embedding service ready');
  }

  /**
   * Generate embedding for a single text
   */
  public async generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (!text.trim()) {
      throw new Error('Text cannot be empty');
    }

    if (this.openai) {
      return await this.generateOpenAIEmbedding(text);
    } else {
      return this.generateTFIDFEmbedding(text);
    }
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   */
  public async generateBatchEmbeddings(texts: string[]): Promise<EmbeddingBatch> {
    if (texts.length === 0) {
      throw new Error('Texts array cannot be empty');
    }

    if (this.openai) {
      return await this.generateOpenAIBatchEmbeddings(texts);
    } else {
      const embeddings = await Promise.all(
        texts.map(text => this.generateTFIDFEmbedding(text))
      );
      
      return {
        embeddings: embeddings.map(result => result.embedding),
        totalTokens: embeddings.reduce((sum, result) => sum + (result.tokens || 0), 0)
      };
    }
  }

  /**
   * Generate OpenAI embedding
   */
  private async generateOpenAIEmbedding(text: string): Promise<EmbeddingResult> {
    if (!this.openai) throw new Error('OpenAI not available');

    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text,
        dimensions: this.dimensions
      });

      const embedding = response.data[0];
      
      return {
        embedding: embedding.embedding,
        dimensions: embedding.embedding.length,
        tokens: response.usage?.total_tokens
      };
    } catch (error: any) {
      throw new Error(`Failed to generate OpenAI embedding: ${error.message}`);
    }
  }

  /**
   * Generate OpenAI batch embeddings
   */
  private async generateOpenAIBatchEmbeddings(texts: string[]): Promise<EmbeddingBatch> {
    if (!this.openai) throw new Error('OpenAI not available');

    // OpenAI has a limit of ~8000 inputs per request, chunk if needed
    const chunkSize = 1000;
    const chunks = [];
    
    for (let i = 0; i < texts.length; i += chunkSize) {
      chunks.push(texts.slice(i, i + chunkSize));
    }

    const results: EmbeddingBatch[] = [];
    
    for (const chunk of chunks) {
      try {
        const response = await this.openai.embeddings.create({
          model: this.model,
          input: chunk,
          dimensions: this.dimensions
        });

        results.push({
          embeddings: response.data.map(item => item.embedding),
          totalTokens: response.usage?.total_tokens || 0
        });
      } catch (error: any) {
        throw new Error(`Failed to generate batch embeddings: ${error.message}`);
      }
    }

    // Combine results
    return {
      embeddings: results.flatMap(result => result.embeddings),
      totalTokens: results.reduce((sum, result) => sum + result.totalTokens, 0)
    };
  }

  /**
   * Generate TF-IDF based embedding (fallback)
   */
  private generateTFIDFEmbedding(text: string): EmbeddingResult {
    const words = this.tokenize(text);
    const wordCount = new Map<string, number>();
    
    // Count word frequencies
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    // Update global vocabulary and document frequency
    this.updateVocabulary(wordCount);

    // Generate TF-IDF vector
    const embedding = this.computeTFIDF(wordCount, words.length);
    
    return {
      embedding,
      dimensions: embedding.length,
      tokens: words.length
    };
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2) // Remove very short words
      .slice(0, 1000); // Limit to prevent huge vectors
  }

  /**
   * Update global vocabulary and document frequency
   */
  private updateVocabulary(wordCount: Map<string, number>) {
    this.totalDocuments++;
    
    wordCount.forEach((count, word) => {
      if (!this.tfidfVocabulary.has(word)) {
        this.tfidfVocabulary.set(word, this.tfidfVocabulary.size);
      }
      
      this.documentFrequency.set(word, (this.documentFrequency.get(word) || 0) + 1);
    });

    // Limit vocabulary size to prevent memory issues
    if (this.tfidfVocabulary.size > 10000) {
      this.pruneVocabulary();
    }
  }

  /**
   * Prune vocabulary to keep only most frequent words
   */
  private pruneVocabulary() {
    const frequencyEntries = Array.from(this.documentFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8000); // Keep top 8000 words

    const newVocab = new Map<string, number>();
    const newDocFreq = new Map<string, number>();

    frequencyEntries.forEach(([word, freq], index) => {
      newVocab.set(word, index);
      newDocFreq.set(word, freq);
    });

    this.tfidfVocabulary = newVocab;
    this.documentFrequency = newDocFreq;
  }

  /**
   * Compute TF-IDF vector
   */
  private computeTFIDF(wordCount: Map<string, number>, totalWords: number): number[] {
    const vector = new Array(Math.min(this.tfidfVocabulary.size, 1536)).fill(0);
    
    wordCount.forEach((count, word) => {
      const vocabIndex = this.tfidfVocabulary.get(word);
      if (vocabIndex !== undefined && vocabIndex < vector.length) {
        const tf = count / totalWords;
        const df = this.documentFrequency.get(word) || 1;
        const idf = Math.log(this.totalDocuments / df);
        
        vector[vocabIndex] = tf * idf;
      }
    });

    // Normalize vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      return vector.map(val => val / magnitude);
    }

    return vector;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  public calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(magnitude1) * Math.sqrt(magnitude2);
    
    if (magnitude === 0) return 0;
    
    return Math.max(0, Math.min(1, dotProduct / magnitude));
  }

  /**
   * Find most similar embeddings from a list
   */
  public findMostSimilar(
    queryEmbedding: number[],
    embeddings: Array<{ embedding: number[]; data: any }>,
    topK: number = 5
  ): Array<{ similarity: number; data: any }> {
    const similarities = embeddings.map(item => ({
      similarity: this.calculateSimilarity(queryEmbedding, item.embedding),
      data: item.data
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Check if the service is ready
   */
  public isReady(): boolean {
    return this.ready;
  }

  /**
   * Get service status
   */
  public getStatus() {
    return {
      ready: this.ready,
      usingOpenAI: !!this.openai,
      model: this.model,
      dimensions: this.dimensions,
      vocabularySize: this.tfidfVocabulary.size,
      totalDocuments: this.totalDocuments
    };
  }

  /**
   * Reset TF-IDF state (for testing or retraining)
   */
  public resetTFIDF() {
    this.tfidfVocabulary.clear();
    this.documentFrequency.clear();
    this.totalDocuments = 0;
  }
}

// Singleton instance
export const embeddingService = new EmbeddingService();