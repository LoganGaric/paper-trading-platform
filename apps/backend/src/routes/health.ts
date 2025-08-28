import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      error?: string;
    };
  };
}

/**
 * Basic health check endpoint
 */
router.get('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const result: HealthCheckResult = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: {
          status: 'healthy'
        }
      }
    };

    // Test database connection
    try {
      const dbStartTime = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      result.services.database.responseTime = Date.now() - dbStartTime;
    } catch (dbError: any) {
      result.services.database.status = 'unhealthy';
      result.services.database.error = dbError.message;
      result.status = 'unhealthy';
    }

    const statusCode = result.status === 'healthy' ? 200 : 503;
    
    logger.info('Health check completed', {
      status: result.status,
      duration: Date.now() - startTime,
      services: result.services
    });

    res.status(statusCode).json(result);
  } catch (error: any) {
    logger.error('Health check failed', { 
      error: error.message,
      duration: Date.now() - startTime
    });

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Readiness probe - checks if service is ready to handle requests
 */
router.get('/ready', async (req, res) => {
  try {
    // Test database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    // Test that essential tables exist
    await prisma.account.findFirst();
    
    logger.info('Readiness check passed');
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Readiness check failed', { error: error.message });
    
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Liveness probe - simple check that service is running
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid
  });
});

export default router;