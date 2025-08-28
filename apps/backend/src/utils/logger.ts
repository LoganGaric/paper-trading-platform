import winston from 'winston';

// Custom log format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service, requestId, userId, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      message,
      service: service || 'paper-trading-backend',
      ...(requestId && { requestId }),
      ...(userId && { userId }),
      ...meta
    };
    return JSON.stringify(logEntry);
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'paper-trading-backend'
  },
  transports: [
    // Console logging for development
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'development' 
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        : logFormat
    }),
    
    // File logging for production
    ...(process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5
      })
    ] : [])
  ]
});

// Stream for morgan middleware
export const logStream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

// Utility functions for contextual logging
export const createLoggerWithContext = (context: Record<string, any>) => {
  return {
    error: (message: string, meta?: any) => logger.error(message, { ...context, ...meta }),
    warn: (message: string, meta?: any) => logger.warn(message, { ...context, ...meta }),
    info: (message: string, meta?: any) => logger.info(message, { ...context, ...meta }),
    debug: (message: string, meta?: any) => logger.debug(message, { ...context, ...meta })
  };
};

// Error logging helper
export const logError = (error: Error, context?: Record<string, any>) => {
  logger.error(error.message, {
    stack: error.stack,
    name: error.name,
    ...context
  });
};

// Performance timing helper
export const createTimer = (operation: string) => {
  const start = Date.now();
  return {
    end: (meta?: Record<string, any>) => {
      const duration = Date.now() - start;
      logger.info(`Operation completed`, {
        operation,
        duration,
        ...meta
      });
      return duration;
    }
  };
};