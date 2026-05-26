import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './lib/db.js';
import { loadConfig } from './config/index.js';
import { logger } from './lib/logger.js';

async function main(): Promise<void> {
  const config = loadConfig();
  await connectDatabase();

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, 'lahtha-click server listening');
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'shutting down');
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

void main().catch((err) => {
  logger.error({ err }, 'fatal startup error');
  process.exit(1);
});
