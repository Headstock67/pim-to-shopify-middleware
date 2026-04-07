import { app } from './app';
import { config } from './config';
import { logger } from './logging';
import { healthState } from './routes/health';

const server = app.listen(config.PORT, () => {
  healthState.isReady = true;
  logger.info(`🚀 ${config.SERVICE_NAME} strictly booted upon port ${config.PORT} handling ${config.NODE_ENV} traffic context.`);
});

// Explicit ALB / Loadbalancer Timeout Parities preventing TCP Drops
server.keepAliveTimeout = config.SERVER_TIMEOUT_MS;
server.headersTimeout = config.SERVER_TIMEOUT_MS + 1000;

// Fatal Catchers ensuring exact crash safety
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, '💥 Uncaught Exception mapped! Forcing immediate process kill pipeline...');
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, '💥 Unhandled Promise Rejection trapped! Forcing immediate process kill pipeline...');
  process.exit(1);
});

// Graceful Container Termination Handlers 
const gracefulShutdown = (signal: string) => {
  logger.warn(`Termination signal ${signal} received. Initiating strict shutdown boundary sequence...`);
  
  // Halt ingress acceptance routing logic natively
  healthState.isReady = false;

  server.close((err) => {
    if (err) {
      logger.error({ err }, `Catastrophic server tear-down failure flagged terminating via ${signal}.`);
      process.exit(1);
    }
    logger.info('Clean socket teardown successful. Node terminating nominally.');
    process.exit(0);
  });

  // Structural deadlock failsafe handler preventing hanging workers
  setTimeout(() => {
    logger.fatal('Internal structural connections refused to close promptly. Engaging brutal teardown logic.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
