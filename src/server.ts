import 'dotenv/config';
import app from './app';
import { env } from './config/env';
import prisma from './config/db';
import logger from './utils/logger';

const start = async (): Promise<void> => {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('✅ Database connected successfully');

    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 DIRECTRONICS ERP API running on port ${env.PORT} [${env.NODE_ENV}]`);
      logger.info(`📌 Health: http://localhost:${env.PORT}/health`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('Database disconnected');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Unhandled promise rejections
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection:', { reason });
      process.exit(1);
    });

  } catch (err) {
    logger.error('❌ Failed to start server:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
};

start();
