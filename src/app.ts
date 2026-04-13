import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { asyncContext } from './middleware/asyncContext';
import { healthRouter } from './routes/health';
import { rootRouter } from './routes/root';
import { authRouter } from './routes/auth';
import { productsRouter } from './routes/products';
import { pimImportRouter } from './routes/pimImport';
import { config } from './config';
import { AppError } from './errors/AppError';

export const app = express();

// 1. Seed the Async Node Context at the absolute edge of ingress
app.use((req, res, next) => {
  const requestId = randomUUID();
  req.id = requestId;
  asyncContext.run({ requestId }, () => {
    next();
  });
});

// 2. Pino request correlator injections MUST run immediately 
// to ensure downstream cors/parser rejections are fully logged
app.use(requestLogger);

// 3. Secure HTTP response base footprint
// Shopify Embedded Apps MUST run inside an iframe securely governed by CSP frameAncestors directly allowing admin.shopify.com natively
app.use(helmet({
  frameguard: false, // Explicitly overriding default X-Frame-Options: SAMEORIGIN blocker
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'self'", "https://*.myshopify.com", "https://admin.shopify.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  }
})); 
app.disable('x-powered-by');

// 4. Explicit origin-only CORS control mapping
const allowedOrigins = config.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser/internal requests (curl, server-to-server)
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.some(allowed => {
      // Escape regex metacharacters, then safely restore the intended exact wildcard '*'
      const escaped = allowed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regexStrict = new RegExp('^' + escaped.replace(/\\\*/g, '.*') + '$');
      return regexStrict.test(origin);
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new AppError({
        message: 'Origin violation suppressed by strict CORS configuration',
        code: 'CORS_ORIGIN_FORBIDDEN',
        statusCode: 403,
        isRetryable: false
      }));
    }
  }
}));

// 5. Size bounded request parsers. SyntaxError blocks caught gracefully by Global Express handler middleware.
app.use(express.json({ limit: '100kb' }));

// 6. Internal infrastructure health paths. Purposely unauthenticated inside App.
app.use('/health', healthRouter);

// 7. Embedded Shopify Test Harness Routes explicitly bound over public tunneling
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/pim-import', pimImportRouter);
app.use('/', rootRouter);

// 8. Global Error trapping boundary 
app.use(errorHandler);
