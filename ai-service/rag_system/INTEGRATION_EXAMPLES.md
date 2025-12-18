"""
Integration Examples - How to Use RAG System in Your Application
Shows practical code examples for frontend, backend, and direct API usage
"""

# ============================================================================
# EXAMPLE 1: Direct API Usage (cURL - Testing)
# ============================================================================

"""
Test RAG system with simple cURL commands:

# 1. Health Check
curl http://localhost:8001/health

# 2. Basic Query
curl -X POST http://localhost:8001/query \
  -H "Content-Type: application/json" \
  -d '{"query": "How do I create a trip?"}'

# 3. Query with API Key (Production)
curl -X POST https://trek-tribe-rag.onrender.com/query \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{"query": "What is the cancellation policy?"}'

# 4. Retrieve Only (No Generation)
curl -X POST "http://localhost:8001/retrieve?query=booking&top_k=3"

# 5. Get Statistics
curl http://localhost:8001/stats \
  -H "X-API-Key: your-secret-key"
"""

# ============================================================================
# EXAMPLE 2: Backend Integration (Node.js/TypeScript)
# ============================================================================

# File: services/api/src/services/ragService.ts

"""
import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

interface RAGConfig {
  baseURL: string;
  apiKey: string;
  timeout: number;
}

interface QueryRequest {
  query: string;
  top_k?: number;
  include_sources?: boolean;
  max_generation_length?: number;
}

interface Source {
  source: string;
  title: string;
  score: number;
}

interface RAGResponse {
  answer: string;
  context: string;
  sources: Source[];
  query: string;
}

export class RAGServiceIntegration {
  private client: AxiosInstance;

  constructor(config: RAGConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey
      }
    });

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      response => {
        logger.info(`RAG Query successful: ${response.data.query}`);
        return response;
      },
      error => {
        logger.error(`RAG Query failed: ${error.message}`);
        throw error;
      }
    );
  }

  async query(request: QueryRequest): Promise<RAGResponse> {
    try {
      const response = await this.client.post<RAGResponse>('/query', {
        query: request.query,
        top_k: request.top_k || 3,
        include_sources: request.include_sources !== false,
        max_generation_length: request.max_generation_length || 200
      });

      return response.data;
    } catch (error) {
      logger.error('RAG query failed:', error);
      throw error;
    }
  }

  async health(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200 && response.data.rag_system_ready;
    } catch (error) {
      logger.error('RAG health check failed:', error);
      return false;
    }
  }

  async stats(): Promise<any> {
    try {
      const response = await this.client.get('/stats');
      return response.data;
    } catch (error) {
      logger.error('Failed to get RAG stats:', error);
      return null;
    }
  }
}

// Initialize service
export const ragService = new RAGServiceIntegration({
  baseURL: process.env.RAG_SERVICE_URL || 'http://localhost:8001',
  apiKey: process.env.RAG_API_KEY || '',
  timeout: 30000
});
"""

# ============================================================================
# EXAMPLE 3: Backend Route Implementation
# ============================================================================

# File: services/api/src/routes/ragRoute.ts

"""
import express, { Request, Response } from 'express';
import { ragService } from '../services/ragService';
import { body, validationResult } from 'express-validator';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Query RAG system (user-facing endpoint)
router.post(
  '/query',
  [
    body('query').isString().trim().notEmpty().withMessage('Query required'),
    body('top_k').optional().isInt({ min: 1, max: 10 }),
    body('include_sources').optional().isBoolean()
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { query, top_k, include_sources } = req.body;

      // Log query
      logger.info(`RAG Query from user: ${query}`);

      // Call RAG service
      const result = await ragService.query({
        query,
        top_k: top_k || 3,
        include_sources: include_sources !== false
      });

      // Return result
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error querying RAG:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process query'
      });
    }
  }
);

// Health check
router.get('/health', async (req: Request, res: Response) => {
  try {
    const healthy = await ragService.health();
    res.json({ healthy, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ healthy: false });
  }
});

// Protected stats endpoint
router.get('/stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    const stats = await ragService.stats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

export default router;
"""

# File: services/api/src/index.ts (add to routes section)

"""
import ragRoutes from './routes/ragRoute';

// Add with other routes
app.use('/api/rag', ragRoutes);
"""

# ============================================================================
# EXAMPLE 4: Frontend Integration (React)
# ============================================================================

# File: web/src/services/ragService.ts

"""
import api from '../config/api';

export interface RAGQuery {
  query: string;
  top_k?: number;
  include_sources?: boolean;
}

export interface RAGSource {
  source: string;
  title: string;
  score: number;
}

export interface RAGAnswer {
  answer: string;
  context: string;
  sources: RAGSource[];
  query: string;
}

class RAGClient {
  async query(queryText: string, topK: number = 3): Promise<RAGAnswer> {
    try {
      const response = await api.post<{ success: boolean; data: RAGAnswer }>(
        '/api/rag/query',
        {
          query: queryText,
          top_k: topK,
          include_sources: true
        }
      );

      if (!response.data.success) {
        throw new Error('Failed to query RAG');
      }

      return response.data.data;
    } catch (error) {
      console.error('RAG query failed:', error);
      throw error;
    }
  }

  async health(): Promise<boolean> {
    try {
      const response = await api.get<{ healthy: boolean }>('/api/rag/health');
      return response.data.healthy;
    } catch (error) {
      console.error('RAG health check failed:', error);
      return false;
    }
  }
}

export const ragClient = new RAGClient();
"""

# File: web/src/components/EnhancedAIChatWidget.tsx (Integration)

"""
import React, { useState, useRef, useEffect } from 'react';
import { ragClient, RAGAnswer } from '../services/ragService';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  sources?: RAGSource[];
  timestamp: Date;
}

export const EnhancedAIChatWidget: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ragHealthy, setRagHealthy] = useState(true);

  // Check RAG health on mount
  useEffect(() => {
    checkRAGHealth();
  }, []);

  const checkRAGHealth = async () => {
    const healthy = await ragClient.health();
    setRagHealthy(healthy);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: input,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Query RAG system
      const result: RAGAnswer = await ragClient.query(input, 3);

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        text: result.answer,
        sender: 'assistant',
        sources: result.sources,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to get response:', error);

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        text: 'Sorry, I was unable to process your query. Please try again.',
        sender: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-widget">
      {/* Status indicator */}
      <div className="chat-header">
        <h3>Trek Tribe AI Assistant</h3>
        <span className={`status ${ragHealthy ? 'online' : 'offline'}`}>
          {ragHealthy ? '🟢 Online' : '🔴 Offline'}
        </span>
      </div>

      {/* Messages */}
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.sender}`}>
            <div className="message-text">{msg.text}</div>

            {/* Show sources for assistant messages */}
            {msg.sources && msg.sources.length > 0 && (
              <div className="sources">
                <strong>Sources:</strong>
                {msg.sources.map((src, idx) => (
                  <div key={idx} className="source">
                    <span className="source-title">{src.title}</span>
                    <span className="source-score">
                      {(src.score * 100).toFixed(0)}% match
                    </span>
                  </div>
                ))}
              </div>
            )}

            <small className="timestamp">
              {msg.timestamp.toLocaleTimeString()}
            </small>
          </div>
        ))}
        {loading && <div className="loading">Thinking...</div>}
      </div>

      {/* Input form */}
      <form onSubmit={handleSendMessage}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask anything about trips, booking, or trekking..."
          disabled={loading || !ragHealthy}
        />
        <button type="submit" disabled={loading || !ragHealthy}>
          Send
        </button>
      </form>

      {!ragHealthy && (
        <div className="warning">
          ⚠️ AI Assistant is currently offline. Please try again later.
        </div>
      )}
    </div>
  );
};
"""

# ============================================================================
# EXAMPLE 5: Common Query Patterns
# ============================================================================

"""
Example queries that work well with the RAG system:

1. TRIP CREATION
   - "How do I create a trip?"
   - "What are the 7 steps to create a trip on Trek Tribe?"
   - "What information do I need to create a trip?"
   - "How much does it cost to create trips?"

2. BOOKING PROCESS
   - "How do I book a trip?"
   - "What payment methods are available?"
   - "How long does booking verification take?"
   - "What is the refund policy?"

3. ORGANIZER FEATURES
   - "What is the CRM dashboard?"
   - "How do I manage bookings?"
   - "What subscription plans are available?"
   - "How do I track payments?"

4. TRAVELER INFO
   - "What should I pack for a trek?"
   - "How do I prevent altitude sickness?"
   - "When is the best time to trek?"
   - "What is required before booking a trip?"

5. SAFETY & HEALTH
   - "What are safety tips for trekking?"
   - "How do I prepare physically for a trek?"
   - "What medical supplies should I bring?"
   - "What should I do if I get lost?"
"""

# ============================================================================
# EXAMPLE 6: Error Handling
# ============================================================================

# File: web/src/services/ragErrorHandler.ts

"""
export class RAGError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: any
  ) {
    super(message);
    this.name = 'RAGError';
  }
}

export const handleRAGError = (error: any): RAGError => {
  if (error.response?.status === 401) {
    return new RAGError(
      'Authentication failed. Invalid API key.',
      401,
      error
    );
  }

  if (error.response?.status === 503) {
    return new RAGError(
      'RAG service is temporarily unavailable. Please try again later.',
      503,
      error
    );
  }

  if (error.response?.status === 400) {
    return new RAGError(
      'Invalid query. Please try rephrasing.',
      400,
      error
    );
  }

  if (error.code === 'ECONNREFUSED') {
    return new RAGError(
      'Cannot connect to RAG service. Check if service is running.',
      undefined,
      error
    );
  }

  return new RAGError(
    'Failed to get response from AI assistant',
    error.response?.status,
    error
  );
};
"""

# ============================================================================
# EXAMPLE 7: Performance Optimization - Caching
# ============================================================================

# File: web/src/utils/ragCache.ts

"""
import { RAGAnswer } from '../services/ragService';

interface CacheEntry {
  answer: RAGAnswer;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class RAGCache {
  private cache = new Map<string, CacheEntry>();
  private readonly DEFAULT_TTL = 1000 * 60 * 60; // 1 hour

  private hash(query: string): string {
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
    }
    return hash.toString();
  }

  set(query: string, answer: RAGAnswer, ttl = this.DEFAULT_TTL): void {
    const key = this.hash(query);
    this.cache.set(key, {
      answer,
      timestamp: Date.now(),
      ttl
    });
  }

  get(query: string): RAGAnswer | null {
    const key = this.hash(query);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.answer;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const ragCache = new RAGCache();
"""

# ============================================================================
# EXAMPLE 8: Monitoring & Analytics
# ============================================================================

# File: web/src/services/ragAnalytics.ts

"""
interface QueryAnalytics {
  query: string;
  responseTime: number;
  sourcesUsed: number;
  userFeedback?: 'helpful' | 'not-helpful';
  category?: string;
}

export class RAGAnalytics {
  private queries: QueryAnalytics[] = [];

  recordQuery(analytics: QueryAnalytics): void {
    this.queries.push({
      ...analytics,
      // Add timestamp automatically
      timestamp: new Date().toISOString()
    });

    // Send to backend for analysis
    this.sendAnalytics(analytics);
  }

  private async sendAnalytics(analytics: QueryAnalytics): Promise<void> {
    try {
      await fetch('/api/analytics/rag-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analytics)
      });
    } catch (error) {
      console.error('Failed to send analytics:', error);
    }
  }

  getStats() {
    return {
      totalQueries: this.queries.length,
      averageResponseTime: 
        this.queries.reduce((sum, q) => sum + q.responseTime, 0) / 
        this.queries.length,
      helpfulRatio:
        this.queries.filter(q => q.userFeedback === 'helpful').length /
        this.queries.length
    };
  }
}

export const ragAnalytics = new RAGAnalytics();
"""
"""

---

## Summary

These examples show:
1. **cURL**: Quick testing
2. **Backend**: Node.js integration
3. **Routes**: Express endpoints
4. **Frontend**: React component
5. **Common Queries**: What works well
6. **Error Handling**: Graceful failures
7. **Caching**: Performance optimization
8. **Analytics**: Usage tracking

All components work together to provide a seamless RAG experience
for your Trek Tribe users!
