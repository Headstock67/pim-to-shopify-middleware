import pino from 'pino';
import { config } from '../config';
import { asyncContext } from '../middleware/asyncContext';

export const logger = pino({
  level: config.LOG_LEVEL,
  name: config.SERVICE_NAME,
  mixin() {
    const store = asyncContext.getStore();
    return store ? { reqId: store.requestId } : {}; 
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers.set-cookie'
    ],
    censor: '[REDACTED]'
  }
});
