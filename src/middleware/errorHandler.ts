import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { logger } from '../logging';

interface BodyParserSyntaxError extends SyntaxError {
  status: number;
  body: string;
}

function isBodyParserSyntaxError(err: unknown): err is BodyParserSyntaxError {
  return err instanceof SyntaxError && 'status' in err && 'body' in err;
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Gracefully catch body-parser SyntaxErrors (e.g., malformed JSON parsing within the 100kb limit)
  if (isBodyParserSyntaxError(err) && err.status === 400) {
    logger.warn({ err }, 'Malformed JSON payload rejected');
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'Malformed JSON payload',
        details: {}
      }
    });
    return;
  }

  // Handle known application errors
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.fatal({ err }, 'Non-operational AppError encountered');
    } else {
      logger.error({ err }, 'Operational AppError handled');
    }
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
    return;
  }

  // Unknown Exceptions (fallbacks) masked as 500s safely to the client
  logger.fatal({ err }, 'Unexpected unhandled exception encountered');
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      details: {}
    }
  });
}
