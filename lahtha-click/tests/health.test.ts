import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('health endpoints', () => {
  const app = createApp();

  it('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /ready returns 503 when db disconnected', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'not_ready', db: 'disconnected' });
  });

  it('echoes incoming x-correlation-id', async () => {
    const res = await request(app).get('/health').set('x-correlation-id', 'test-corr-123');
    expect(res.headers['x-correlation-id']).toBe('test-corr-123');
  });

  it('generates a uuid when no correlation id provided', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-correlation-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
