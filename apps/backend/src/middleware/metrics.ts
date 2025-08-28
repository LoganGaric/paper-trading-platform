import { Request, Response, NextFunction } from 'express';
import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { logger } from '../utils/logger';

// Enable collection of default metrics
collectDefaultMetrics({
  prefix: 'paper_trading_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
});

// Custom metrics
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

const activeConnections = new Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections'
});

const databaseConnectionPool = new Gauge({
  name: 'database_connection_pool_size',
  help: 'Size of database connection pool'
});

const databaseQueryDuration = new Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
});

// Business metrics
const ordersCreated = new Counter({
  name: 'orders_created_total',
  help: 'Total number of orders created',
  labelNames: ['type', 'side', 'status']
});

const orderValue = new Histogram({
  name: 'order_value_dollars',
  help: 'Value of orders in dollars',
  labelNames: ['type', 'side'],
  buckets: [10, 50, 100, 500, 1000, 5000, 10000, 50000]
});

const riskChecksTotal = new Counter({
  name: 'risk_checks_total',
  help: 'Total number of risk checks performed',
  labelNames: ['result', 'rule_type']
});

const positionUpdates = new Counter({
  name: 'position_updates_total',
  help: 'Total number of position updates',
  labelNames: ['operation']
});

const accountBalance = new Gauge({
  name: 'account_balance_dollars',
  help: 'Current account balances in dollars',
  labelNames: ['account_id']
});

// Middleware to track HTTP metrics
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  activeConnections.inc();
  
  // Extract route pattern for better grouping
  const route = req.route?.path || req.path;
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode.toString()
    };
    
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duration);
    activeConnections.dec();
    
    // Log slow requests
    if (duration > 1) {
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.url,
        duration,
        statusCode: res.statusCode,
        requestId: req.requestId
      });
    }
  });
  
  next();
};

// Utility functions to track business metrics
export const trackOrder = (orderType: string, side: string, status: string, value: number) => {
  ordersCreated.inc({ type: orderType, side, status });
  orderValue.observe({ type: orderType, side }, value);
};

export const trackRiskCheck = (result: 'passed' | 'failed', ruleType: string) => {
  riskChecksTotal.inc({ result, rule_type: ruleType });
};

export const trackPositionUpdate = (operation: 'create' | 'update' | 'delete') => {
  positionUpdates.inc({ operation });
};

export const updateAccountBalance = (accountId: string, balance: number) => {
  accountBalance.set({ account_id: accountId }, balance);
};

export const trackDatabaseQuery = (operation: string, table: string, duration: number) => {
  databaseQueryDuration.observe({ operation, table }, duration / 1000);
};

// Database metrics wrapper
export const withDatabaseMetrics = <T>(
  operation: string,
  table: string,
  fn: () => Promise<T>
): Promise<T> => {
  const start = Date.now();
  return fn().then(
    (result) => {
      trackDatabaseQuery(operation, table, Date.now() - start);
      return result;
    },
    (error) => {
      trackDatabaseQuery(operation, table, Date.now() - start);
      throw error;
    }
  );
};

// System metrics collection
export const collectSystemMetrics = () => {
  const memoryUsage = process.memoryUsage();
  
  // Update custom gauges with system information
  logger.info('System metrics collected', {
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024)
    },
    uptime: process.uptime(),
    pid: process.pid
  });
};

// Metrics endpoint
export const getMetrics = () => {
  return register.metrics();
};

// Start system metrics collection
setInterval(collectSystemMetrics, 60000); // Every minute