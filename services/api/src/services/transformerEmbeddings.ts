/**
 * Lightweight pure JavaScript embeddings service
 * Uses TF-IDF + cosine similarity for semantic search
 * No native dependencies, works everywhere (local, Docker, Render, etc.)
 */

interface TokenIndex {
  [token: string]: number[];
}

/**
 * Pure JavaScript implementation of embeddings using TF-IDF
 * Much simpler than transformers, no ONNX runtime needed
 */
export class TransformerEmbeddingService {
  private static instance: TransformerEmbeddingService;
  private isInitialized = true; // No async init needed
  private documents: Map<string, number[]> = new Map();
  private tokenIndex: TokenIndex = {};
  private documentIds: string[] = [];
  private documentTexts: string[] = [];

  static getInstance(): TransformerEmbeddingService {
    if (!TransformerEmbeddingService.instance) {
      TransformerEmbeddingService.instance = new TransformerEmbeddingService();
    }
    return TransformerEmbeddingService.instance;
  }

  constructor() {
    console.log('✅ Using pure JavaScript embeddings (no native dependencies)');
  }

  /**
   * Simple tokenizer - converts text to lowercase tokens
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/)
      .filter(token => token.length > 2); // Filter short tokens
  }

  /**
   * Calculate TF-IDF score for a token
   */
  private calculateTfIdf(token: string, documentText: string): number {
    // Term frequency
    const tokens = this.tokenize(documentText);
    const tf = tokens.filter(t => t === token).length / tokens.length;

    // Document frequency
    const docsWithToken = this.documentTexts.filter(doc => 
      this.tokenize(doc).includes(token)
    ).length;
    const idf = Math.log((this.documentTexts.length || 1) / (docsWithToken || 1));

    return tf * idf;
  }

  /**
   * Generate embedding using TF-IDF
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const tokens = this.tokenize(text);
    const uniqueTokens = [...new Set(tokens)];

    // Create embedding vector based on TF-IDF scores
    const embedding = uniqueTokens.map(token => 
      this.calculateTfIdf(token, text)
    );

    // Normalize embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 
      ? embedding.map(val => val / magnitude)
      : embedding;
  }

  /**
   * Batch generate embeddings
   */
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    // Update document tracking for IDF calculation
    this.documentTexts = texts;
    this.documentIds = texts.map((_, i) => i.toString());

    return Promise.all(
      texts.map(text => this.generateEmbedding(text))
    );
  }

  /**
   * Similarity score between two embeddings using cosine similarity
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    const dotProduct = vec1.reduce((sum, val, i) => sum + val * (vec2[i] || 0), 0);
    const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));

    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Advanced initialization (optional, can be called to pre-compute embeddings)
   */
  async initialize(): Promise<void> {
    // No-op, initialization happens on demand
    console.log('🤖 JavaScript embeddings service ready');
  }

  /**
   * Add document to index for better similarity calculation
   */
  addDocument(id: string, text: string): void {
    this.documentIds.push(id);
    this.documentTexts.push(text);
    this.documents.set(id, []);
  }

  /**
   * Find similar documents to a query
   */
  async findSimilar(query: string, topK: number = 3): Promise<Array<{ id: string; score: number }>> {
    const queryEmbedding = await this.generateEmbedding(query);

    const similarities = this.documentTexts.map((text, idx) => {
      const docEmbedding = this.calculateTfIdfVector(text);
      const score = this.cosineSimilarity(queryEmbedding, docEmbedding);
      return { id: this.documentIds[idx], score };
    });

    return similarities
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Helper to calculate TF-IDF vector for a document
   */
  private calculateTfIdfVector(text: string): number[] {
    const tokens = this.tokenize(text);
    const uniqueTokens = [...new Set(tokens)];
    return uniqueTokens.map(token => this.calculateTfIdf(token, text));
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

export const transformerEmbeddings = TransformerEmbeddingService.getInstance();
