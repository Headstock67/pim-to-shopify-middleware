import request from 'supertest';
import { app } from '../src/app';
import { healthState } from '../src/routes/health';

describe('Health & Observability Endpoints', () => {
  it('GET /health/live returns HTTP 200 alive status unconditionally', async () => {
    const response = await request(app).get('/health/live');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('alive');
  });

  it('GET /health/ready returns HTTP 503 when isReady is false', async () => {
    healthState.isReady = false;
    const response = await request(app).get('/health/ready');
    expect(response.status).toBe(503);
    expect(response.body.status).toBe('not_ready');
  });

  it('GET /health/ready returns HTTP 200 when isReady is true', async () => {
    healthState.isReady = true;
    const response = await request(app).get('/health/ready');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
  });

  it('GET /health/status returns accurate infrastructure payload shapes', async () => {
    const response = await request(app).get('/health/status');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('service');
    expect(response.body).toHaveProperty('dependencies.shopify', 'unconnected');
    expect(response.body).toHaveProperty('uptime');
  });
});
