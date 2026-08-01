import request from 'supertest';
import app from '../index';

describe('GET /health — postgres', () => {
  it('reports a connected postgres status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.postgres).toBeDefined();
    expect(res.body.postgres.status).toBe('connected');
  });
});
