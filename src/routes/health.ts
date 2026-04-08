import { Router } from 'express';
import { config } from '../config';
import { requireApiToken } from '../middleware/auth';

export const healthRouter = Router();

// Internal state dictionary toggled via `server.ts` upon success bindings
export const healthState = {
  isReady: false
};

// Signals simple Node event loop liveness
healthRouter.get('/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

// Signals capability to actively accept operational traffic
healthRouter.get('/ready', (req, res) => {
  if (healthState.isReady) {
    res.status(200).json({ status: 'ready' });
  } else {
    // Return 503 instead of 400 for structural dependency limits so LBs correctly queue traffic
    res.status(503).json({ status: 'not_ready' });
  }
});

// Rigorous full state overview endpoint internally gated
healthRouter.get('/status', requireApiToken, (req, res) => {
  res.status(200).json({
    service: config.SERVICE_NAME,
    environment: config.NODE_ENV,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    isReady: healthState.isReady,
    dependencies: {
      shopify: 'unconnected' // explicit omission placeholder
    }
  });
});
