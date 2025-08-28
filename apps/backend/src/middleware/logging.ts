import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger, createLoggerWithContext } from '../utils/logger';

// Extend Request interface to include logging context
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
      logger: ReturnType<typeof createLoggerWithContext>;
    }
  }
}

/**
 * Request ID middleware - adds unique request ID to each request
 */
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  req.requestId = uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

/**
 * Request timing middleware - tracks request duration
 */
export const requestTiming = (req: Request, res: Response, next: NextFunction) => {
  req.startTime = Date.now();
  next();
};

/**
 * Request logging middleware - adds contextual logger and logs requests
 */
export const requestLogging = (req: Request, res: Response, next: NextFunction) => {
  // Create contextual logger for this request
  req.logger = createLoggerWithContext({
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress
  });

  // Log incoming request
  req.logger.info('Incoming request', {
    body: sanitizeRequestBody(req.body),
    query: req.query,
    headers: sanitizeHeaders(req.headers)
  });

  // Intercept response to log completion
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - req.startTime;
    
    req.logger.info('Request completed', {
      statusCode: res.statusCode,
      duration,
      responseSize: Buffer.byteLength(body || ''),
      ...(res.statusCode >= 400 && { responseBody: sanitizeResponseBody(body) })
    });

    return originalSend.call(this, body);
  };

  next();
};

/**
 * Error logging middleware - logs all errors with context
 */
export const errorLogging = (err: any, req: Request, res: Response, next: NextFunction) => {
  const context = {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    statusCode: err.statusCode || 500,
    duration: Date.now() - req.startTime
  };

  logger.error(err.message, {
    ...context,
    stack: err.stack,
    name: err.name
  });

  next(err);
};

/**
 * Sanitize request body to remove sensitive information
 */
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') return body;

  const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Sanitize headers to remove sensitive information
 */
function sanitizeHeaders(headers: any): any {
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
  const sanitized = { ...headers };

  for (const header of sensitiveHeaders) {
    if (header in sanitized) {
      sanitized[header] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Sanitize response body for logging (only for error responses)
 */
function sanitizeResponseBody(body: any): any {
  try {
    const parsed = JSON.parse(body);
    // Only log error responses, not success data
    if (parsed.error) {
      return { error: parsed.error };
    }
    return '[SUCCESS_RESPONSE]';
  } catch {
    return '[NON_JSON_RESPONSE]';
  }
}