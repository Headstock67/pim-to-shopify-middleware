import { randomUUID } from 'crypto';
import { db } from './db';
import { logger } from '../logging';

export type EventSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface SystemEventPayload {
  severity: EventSeverity;
  eventType: string;
  domain: string;
  message: string;
  details?: any;
  requestId?: string;
  resourceId?: string;
}

/**
 * Ensures JSON serialization does not crash.
 * Attempts JSON.stringify. On circular dependencies or issues, falls back to "{}".
 */
function safeStringify(obj: any): string {
  if (obj === undefined || obj === null) return '{}';
  try {
    return JSON.stringify(obj);
  } catch (e) {
    return '{}';
  }
}

/**
 * Records a system event persistently into Postgres and the Pino logger.
 * NEVER blocks response inherently. Safely wraps insertion in try-catch.
 */
export async function recordSystemEvent(payload: SystemEventPayload): Promise<string> {
  const eventId = randomUUID();
  const detailsJson = safeStringify(payload.details);
  
  // Reconstruct a strictly sanitized object exactly as the DB will store it
  const sanitizedDetails = JSON.parse(detailsJson);

  // 1. Dual-emit to logger without using logger.fatal explicitly
  const logObj = {
    eventId,
    eventType: payload.eventType,
    domain: payload.domain,
    requestId: payload.requestId,
    resourceId: payload.resourceId,
    details: sanitizedDetails
  };

  switch (payload.severity) {
    case 'info':
      logger.info(logObj, payload.message);
      break;
    case 'warning':
      logger.warn(logObj, payload.message);
      break;
    case 'error':
    case 'critical':
      // Specifically route 'critical' safely to 'error'.
      logger.error(logObj, payload.message);
      break;
  }

  // 2. Insert into Postgres safely
  try {
    const query = `
      INSERT INTO system_events 
        (id, severity, event_type, domain, request_id, resource_id, message, details_json) 
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    const params = [
      eventId,
      payload.severity,
      payload.eventType,
      payload.domain,
      payload.requestId || null,
      payload.resourceId || null,
      payload.message,
      detailsJson
    ];

    await db.query(query, params);
  } catch (error: any) {
    // 3. Fallback safely avoiding application throw
    logger.error({ dbError: error.message, eventId }, 'Failed to persist system event to database.');
  }

  // 4. Return the ID safely
  return eventId;
}
