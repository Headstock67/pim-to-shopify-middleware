import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SERVICE_NAME: z.string().default('pendulum-ops-middleware'),
  RETRY_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(3),
  RETRY_BASE_DELAY_MS: z.coerce.number().int().min(1).default(1000),
  SERVER_TIMEOUT_MS: z.coerce.number().int().min(1).default(30000),
  CORS_ALLOWED_ORIGINS: z.string()
    .min(1, 'CORS_ALLOWED_ORIGINS is required (e.g., http://localhost:3000).')
    .refine(
      (val) => !val.split(',').map(o => o.trim()).includes('*'),
      'CONFIG_INVALID_CORS_WILDCARD: Global wildcard (*) CORS is strictly forbidden.'
    ),
  SHOPIFY_API_KEY: z.string().min(1, 'Shopify API Key is strictly required structurally.'),
  SHOPIFY_API_SECRET: z.string().min(1, 'Shopify API Secret is directly required.'),
  SHOPIFY_REDIRECT_URI: z.string().url(),
  DATABASE_URL: z.string().url('DATABASE_URL must be a structurally valid Postgres URI natively.'),
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must explicitly map to perfectly exactly 64 hex characters (32 bytes).').regex(/^[0-9a-fA-F]{64}$/, 'Must manually be a mathematically valid hex string.')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast on missing/invalid config to prevent partially running states
  console.error('Fatal Error: Invalid environment parameters detected during startup');
  console.error(parsed.error.format());
  process.exit(1);
}

// Global immutable config object
export const config = parsed.data;
