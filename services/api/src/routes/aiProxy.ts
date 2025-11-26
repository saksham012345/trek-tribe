/**
 * AI proxy route
 *
 * Forwards AI generation requests from the frontend to the Python FastAPI
 * AI microservice. Uses a server-side API key so the client never holds
 * the AI service secret.
 */
import express, { Request, Response } from 'express';
import axios from 'axios';

const router = express.Router();

const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY || process.env.AI_KEY || '';
const TIMEOUT_MS = parseInt(process.env.AI_PROXY_TIMEOUT_MS || process.env.AI_PROXY_TIMEOUT || '120000', 10);

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { prompt, max_tokens, top_k } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: '`prompt` is required and must be a string' });
    }

    const resp = await axios.post(
      `${AI_SERVICE_URL}/generate`,
      { prompt, max_tokens, top_k },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': AI_SERVICE_KEY,
        },
        timeout: TIMEOUT_MS,
      }
    );

    const data: any = resp.data || {};
    const normalized = {
      text: typeof data.text === 'string' ? data.text : (data?.text || JSON.stringify(data)),
      actions: Array.isArray(data.actions) ? data.actions : (data.actions ? [data.actions] : []),
      raw: data.raw || data.text || data,
      retrieved_sources: Array.isArray(data.retrieved_sources) ? data.retrieved_sources : (data.retrieved_sources ? [data.retrieved_sources] : []),
    };

    return res.status(200).json(normalized);
  } catch (err: any) {
    if (err.response && err.response.data) {
      const status = err.response.status || 502;
      const message = err.response.data?.detail || err.response.data?.error || JSON.stringify(err.response.data);
      return res.status(status).json({ error: 'ai_service_error', message });
    }
    console.error('AI proxy error:', err?.message || err);
    return res.status(502).json({ error: 'ai_service_unavailable', message: 'AI service unavailable' });
  }
});

export default router;
