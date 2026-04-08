import { db } from '../../services/db';
import { logger } from '../../logging';

/**
 * Initializes the system_events table.
 * Failing to initialize does NOT crash the application, it merely logs an error.
 */
export async function initSystemEventsTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS system_events (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      severity TEXT NOT NULL,
      event_type TEXT NOT NULL,
      domain TEXT NOT NULL,
      request_id TEXT,
      resource_id TEXT,
      message TEXT NOT NULL,
      details_json TEXT DEFAULT '{}'
    );
  `;
  try {
    await db.query(query);
    logger.info('System Events table successfully initialized.');
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to initialize system_events table.');
  }
}
