import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';
import { RateLimitError } from './errorHandling';

// Custom rate limit handler
const rateLimitHandler = (req: Request, res: Response) => {
  logger.warn('Rate limit exceeded', {
    ip: req.ip,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    requestId: req.requestId
  });
  
  const error = new RateLimitError('Too many requests, please try again later');
  res.status(429).json({
    success: false,
    error: error.message,
    code: error.errorCode,
    requestId: req.requestId,
    retryAfter: Math.ceil(req.rateLimit?.resetTime ? (req.rateLimit.resetTime - Date.now()) / 1000 : 60)
  });
};

// Skip rate limiting for certain conditions
const skipSuccessfulRequests = (req: Request, res: Response) => {
  // Skip rate limiting for health checks
  if (req.path.startsWith('/health') || req.path.startsWith('/metrics')) {
    return true;
  }
  
  // Skip for successful responses (only count errors/failures)
  return res.statusCode < 400;
};

// Global rate limiting (applies to all routes)
export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  handler: rateLimitHandler
});

// Strict rate limiting for sensitive operations
export const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests for this endpoint, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipSuccessfulRequests // Only count failed requests
});

// Order creation rate limiting
export const orderCreationLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Maximum 60 orders per minute per IP
  message: 'Too many order requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});

// Auth-related rate limiting (login, registration)
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Maximum 5 auth attempts per IP per window
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skipSuccessfulRequests: true // Only count failed auth attempts
});

// Custom rate limiting based on user type
export const createUserSpecificRateLimit = (limits: { [userType: string]: number }) => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req) => {
      // This would be determined by user authentication/authorization
      // For now, default to basic user limit
      const userType = (req as any).user?.type || 'basic';
      return limits[userType] || limits.basic || 100;
    },
    message: 'Rate limit exceeded for your user type',
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler
  });
};

// Rate limiting configuration for different endpoints
export const rateLimitConfigs = {
  // Health checks - no rate limiting
  health: rateLimit({
    windowMs: 1000, // 1 second
    max: 1000, // Very high limit
    skip: () => true // Always skip
  }),
  
  // Public API endpoints
  public: globalRateLimit,
  
  // Order management
  orders: orderCreationLimit,
  
  // Account management
  accounts: strictRateLimit,
  
  // Risk management
  risk: strictRateLimit,
  
  // Authentication
  auth: authRateLimit
};

// Middleware to add rate limit info to response headers
export const rateLimitHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Add custom rate limit headers
  res.set({
    'X-RateLimit-Policy': 'paper-trading-v1',
    'X-Request-ID': req.requestId
  });
  next();
};

// Rate limiting bypass for internal services
export const bypassRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const internalToken = req.get('X-Internal-Token');
  const expectedToken = process.env.INTERNAL_API_TOKEN;
  
  if (internalToken && expectedToken && internalToken === expectedToken) {
    // Mark request as internal to skip rate limiting
    (req as any).internal = true;
    logger.info('Internal request detected, bypassing rate limits', {
      requestId: req.requestId,
      method: req.method,
      url: req.url
    });
  }
  
  next();
};