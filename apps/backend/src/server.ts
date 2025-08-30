import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Routes
import healthRoutes from './routes/health';
import metricsRoutes from './routes/metrics';
import ordersRoutes from './routes/orders';
import positionsRoutes from './routes/positions';
import fillsRoutes from './routes/fills';
import accountsRoutes from './routes/accounts';
import riskRoutes from './routes/risk';
import simulatorRoutes from './routes/simulator';
import { setupWebSocket } from './websocket/websocket';

// Middleware
import { logger } from './utils/logger';
import { requestId, requestTiming, requestLogging, errorLogging } from './middleware/logging';
import { metricsMiddleware } from './middleware/metrics';
import { securityHeaders, inputSanitization, xssProtection, apiSecurityHeaders, pathTraversalProtection, validateContentType } from './middleware/security';
import { globalRateLimit, rateLimitHeaders, bypassRateLimit, rateLimitConfigs } from './middleware/rateLimiting';
import { errorHandler, notFoundHandler, setupGracefulShutdown } from './middleware/errorHandling';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const prisma = new PrismaClient();
const PORT = process.env.PORT || 4001;

// Helper function to check if simulator should be running based on saved state
async function shouldSimulatorBeRunning(): Promise<boolean> {
  try {
    const state = await prisma.simulatorState.findFirst();
    return state?.isRunning || false;
  } catch (error) {
    logger.warn('Failed to check simulator state:', error);
    return false;
  }
}

// Trust proxy if behind reverse proxy
app.set('trust proxy', 1);

// Early middleware - security and parsing
app.use(securityHeaders);
app.use(pathTraversalProtection);
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://your-domain.com']
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:3004', 'http://localhost:3005', 'http://localhost:3006', 'http://localhost:3007', 'http://localhost:3008', 'http://localhost:3009', 'http://localhost:3010', 'http://localhost:3011', 'http://localhost:3012', 'http://localhost:3013', 'http://localhost:3014', 'http://localhost:3015'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));
app.use(compression());

// Body parsing with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Content validation
app.use(validateContentType(['application/json', 'application/x-www-form-urlencoded']));

// Request processing middleware
app.use(requestId);
app.use(requestTiming);
app.use(requestLogging);
app.use(bypassRateLimit);
app.use(metricsMiddleware);
app.use(rateLimitHeaders);
app.use(apiSecurityHeaders);

// Input sanitization
app.use(inputSanitization);
app.use(xssProtection);

// Health and metrics endpoints (no rate limiting)
app.use('/health', rateLimitConfigs.health, healthRoutes);
app.use('/metrics', rateLimitConfigs.health, metricsRoutes);

// API routes with appropriate rate limiting
app.use('/api/orders', rateLimitConfigs.orders, ordersRoutes);
app.use('/api/positions', rateLimitConfigs.public, positionsRoutes);
app.use('/api/fills', rateLimitConfigs.public, fillsRoutes);
app.use('/api/accounts', rateLimitConfigs.accounts, accountsRoutes);
app.use('/api/risk', rateLimitConfigs.risk, riskRoutes);
app.use('/api/simulator', rateLimitConfigs.public, simulatorRoutes);

// WebSocket setup
setupWebSocket(wss, prisma);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Paper Trading Platform API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling middleware (must be last)
app.use(errorLogging);
app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async (): Promise<void> => {
  try {
    // Test database connection
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    
    logger.info('Database connected successfully', {
      nodeEnv: process.env.NODE_ENV,
      port: PORT
    });
    
    server.listen(PORT, () => {
      logger.info('Server started successfully', {
        port: PORT,
        nodeEnv: process.env.NODE_ENV,
        processId: process.pid
      });
      
      logger.info('WebSocket server ready');
      
      // Auto-start market simulator in development or restore state
      setTimeout(async () => {
        try {
          const { getSimulatorInstance } = await import('./routes/simulator');
          const simulator = getSimulatorInstance();
          await simulator.initialize();
          
          // Check if simulator should be running from saved state
          const wasRunning = await shouldSimulatorBeRunning();
          const shouldStart = process.env.NODE_ENV !== 'production' || wasRunning;
          
          if (shouldStart) {
            await simulator.startSimulation();
            logger.info(wasRunning ? 'Market simulator restored from saved state' : 'Market simulator auto-started for development');
          } else {
            logger.info('Market simulator initialized but not started');
          }
        } catch (error) {
          logger.warn('Failed to initialize market simulator:', error);
        }
      }, 1000); // Start after 1 second delay
      
      // Log available endpoints
      logger.info('API endpoints available', {
        endpoints: [
          'GET /',
          'GET /health',
          'GET /health/ready',
          'GET /health/live', 
          'GET /metrics',
          'POST /api/orders',
          'GET /api/orders',
          'POST /api/orders/:id/cancel',
          'GET /api/positions',
          'GET /api/fills',
          'GET /api/accounts',
          'GET /api/risk/limits',
          'PUT /api/risk/limits',
          'GET /api/simulator/status'
        ]
      });
    });
  } catch (error: any) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

// Setup graceful shutdown
setupGracefulShutdown(server);

// Start the server (only in non-serverless environments)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  startServer();
}

// Initialize database for serverless functions
if (process.env.VERCEL) {
  prisma.$connect().catch(console.error);
}

// Export for Vercel serverless functions
export default app;