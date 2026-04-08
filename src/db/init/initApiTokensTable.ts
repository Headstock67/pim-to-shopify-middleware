import { db } from '../../services/db';
import { logger } from '../../logging';

/**
 * Initializes the api_tokens database table used for internal authentication.
 * Failures will log but not crash the application startup sequence.
 */
export async function initApiTokensTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS api_tokens (
      token_id TEXT PRIMARY KEY,
      secret_hash TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      revoked_at TIMESTAMP WITH TIME ZONE
    );
  `;
  try {
    await db.query(query);
    logger.info('API Tokens table successfully initialized.');
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to initialize api_tokens table.');
  }
}
