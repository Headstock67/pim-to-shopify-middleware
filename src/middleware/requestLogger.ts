import pinoHttp from 'pino-http';
import { Request } from 'express';
import { logger } from '../logging';

export const requestLogger = pinoHttp({
  logger,
  genReqId: function (req) {
    return req.id;
  },
  serializers: {
    // Explicitly stripping the body payload ensuring only safe request metadata is tracked
    req: (req: Request) => {
      // Whitelist strict headers to prevent accidental leakage of unredacted exotic tokens
      const safeHeaders = Object.fromEntries(
        Object.entries({
          'host': req.headers['host'],
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type'],
          'content-length': req.headers['content-length'],
          'x-forwarded-for': req.headers['x-forwarded-for'] as string | undefined
        }).filter(([, v]) => v !== undefined)
      );

      return {
        id: req.id,
        method: req.method,
        url: req.originalUrl || req.url,
        headers: safeHeaders,
        remoteAddress: req.socket?.remoteAddress,
        remotePort: req.socket?.remotePort,
      };
    },
    res: (res) => ({
      statusCode: res.statusCode
    })
  }
});
