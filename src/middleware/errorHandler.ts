import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { logger } from '../logging';
import { recordSystemEvent } from '../services/systemEvents';
import { asyncContext } from './asyncContext';

interface BodyParserSyntaxError extends SyntaxError {
  status: number;
  body: string;
}

function isBodyParserSyntaxError(err: unknown): err is BodyParserSyntaxError {
  return err instanceof SyntaxError && 'status' in err && 'body' in err;
}

export async function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const store = asyncContext.getStore();
  const requestId = store?.requestId || 'UNKNOWN_REQ';
  let eventId = 'UNKNOWN_EVENT';

  // 1. Compute safe values for logging and response
  let severity: 'info' | 'warning' | 'error' | 'critical' = 'critical';
  let eventType = 'UNHANDLED_EXCEPTION';
  let statusCode = 500;
  let responseMessage = 'Internal server error';

  if (isBodyParserSyntaxError(err) && err.status === 400) {
    severity = 'warning';
    eventType = 'MALFORMED_JSON';
    statusCode = 400;
    responseMessage = 'Malformed JSON payload';
  } else if (err instanceof AppError) {
    severity = err.isOperational ? 'error' : 'critical';
    eventType = err.code;
    statusCode = err.statusCode;
    responseMessage = err.message;
  }

  // 2. Dual-emit and persist the event securely, never blocking response
  try {
    eventId = await recordSystemEvent({
      severity,
      eventType,
      domain: 'core',
      message: err.message,
      requestId,
      details: err instanceof AppError ? err.details : {} 
    });
  } catch (logErr: any) {
    logger.error({ error: logErr.message }, 'Failed to record system event during error handling.');
  }

  // 3. Return safe JSON responses to the client matching the required generic output format
  res.status(statusCode).json({
    error: responseMessage,
    requestId,
    eventId
  });
}
