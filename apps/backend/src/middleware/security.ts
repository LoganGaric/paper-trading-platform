import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import xss from 'xss';
import { logger } from '../utils/logger';

/**
 * Enhanced security headers using helmet
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for development
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
});

/**
 * Input sanitization middleware
 */
export const inputSanitization = [
  // Prevent NoSQL injection attacks
  mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }: { req: Request; key: string }) => {
      logger.warn('Input sanitization applied', {
        requestId: req.requestId,
        ip: req.ip,
        method: req.method,
        url: req.url,
        sanitizedField: key
      });
    }
  }),
  
  // Prevent HTTP Parameter Pollution
  hpp({
    whitelist: ['tags', 'categories'], // Allow arrays for these fields
  }),
];

/**
 * XSS protection middleware
 */
export const xssProtection = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body, req);
  }
  
  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query, req);
  }
  
  next();
};

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any, req: Request): any {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeValue(obj, req);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, req));
  }
  
  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeObject(value, req);
  }
  
  return sanitized;
}

/**
 * Sanitize individual values
 */
function sanitizeValue(value: any, req: Request): any {
  if (typeof value !== 'string') {
    return value;
  }
  
  const originalValue = value;
  const sanitizedValue = xss(value, {
    whiteList: {}, // No HTML tags allowed
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script']
  });
  
  // Log if XSS attempt detected
  if (originalValue !== sanitizedValue) {
    logger.warn('XSS attempt detected and blocked', {
      requestId: req.requestId,
      ip: req.ip,
      method: req.method,
      url: req.url,
      originalValue: originalValue.substring(0, 100),
      sanitizedValue: sanitizedValue.substring(0, 100)
    });
  }
  
  return sanitizedValue;
}

/**
 * Request size limiting
 */
export const requestSizeLimit = (maxSize: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.get('content-length') || '0');
    const maxBytes = parseSize(maxSize);
    
    if (contentLength > maxBytes) {
      logger.warn('Request too large', {
        requestId: req.requestId,
        ip: req.ip,
        method: req.method,
        url: req.url,
        contentLength,
        maxAllowed: maxBytes
      });
      
      return res.status(413).json({
        success: false,
        error: 'Request entity too large',
        maxSize,
        requestId: req.requestId
      });
    }
    
    next();
  };
};

/**
 * Content-Type validation
 */
export const validateContentType = (allowedTypes: string[] = ['application/json']) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE') {
      return next();
    }
    
    const contentType = req.get('content-type')?.split(';')[0];
    
    if (!contentType || !allowedTypes.includes(contentType)) {
      logger.warn('Invalid content type', {
        requestId: req.requestId,
        ip: req.ip,
        method: req.method,
        url: req.url,
        contentType,
        allowedTypes
      });
      
      return res.status(415).json({
        success: false,
        error: 'Unsupported Media Type',
        allowedTypes,
        requestId: req.requestId
      });
    }
    
    next();
  };
};

/**
 * Path traversal protection
 */
export const pathTraversalProtection = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    /\.\./g,           // Path traversal
    /\0/g,             // Null bytes
    /%2e%2e/gi,        // URL encoded path traversal
    /%00/gi,           // URL encoded null bytes
    /\/{2,}/g          // Multiple slashes
  ];
  
  const fullPath = req.originalUrl || req.url;
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(fullPath)) {
      logger.warn('Path traversal attempt detected', {
        requestId: req.requestId,
        ip: req.ip,
        method: req.method,
        url: req.url,
        originalUrl: req.originalUrl,
        pattern: pattern.toString()
      });
      
      return res.status(400).json({
        success: false,
        error: 'Invalid request path',
        requestId: req.requestId
      });
    }
  }
  
  next();
};

/**
 * Security headers for API responses
 */
export const apiSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Prevent MIME type sniffing
  res.set('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.set('X-Frame-Options', 'DENY');
  
  // Enable XSS protection
  res.set('X-XSS-Protection', '1; mode=block');
  
  // Prevent referrer leakage
  res.set('Referrer-Policy', 'no-referrer');
  
  // Add request ID to response
  res.set('X-Request-ID', req.requestId);
  
  next();
};

/**
 * Utility function to parse size strings
 */
function parseSize(size: string): number {
  const units: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024
  };
  
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([kmg]?b)$/);
  if (!match) {
    throw new Error(`Invalid size format: ${size}`);
  }
  
  const value = parseFloat(match[1]);
  const unit = match[2];
  
  return Math.floor(value * units[unit]);
}