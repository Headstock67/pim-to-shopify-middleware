import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../logging';

// Enforce a strict single shared global connection pool footprint natively
export const db = new Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

db.on('error', (err) => {
  logger.error({ err: err.message }, 'Unexpected Postgres connection pool fault detected natively.');
});

logger.info('Database connection pool formally uniquely natively provisioned securely.');
