import { logger } from './logger';

export interface CircuitBreakerOptions {
  failureThreshold: number;    // Number of failures before opening circuit
  resetTimeout: number;        // Time in ms before attempting to close circuit
  monitoringPeriod: number;    // Time window for counting failures
  expectedErrors?: string[];   // Error types that should trigger circuit breaker
  timeout?: number;           // Request timeout in ms
  name?: string;              // Circuit breaker name for logging
}

export enum CircuitBreakerState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Failing fast, not executing function
  HALF_OPEN = 'half_open' // Testing if service is back up
}

export class CircuitBreakerError extends Error {
  constructor(message: string, public state: CircuitBreakerState) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;
  private readonly name: string;

  constructor(private options: CircuitBreakerOptions) {
    this.name = options.name || 'unknown';
    this.validateOptions();
    
    logger.info('Circuit breaker initialized', {
      name: this.name,
      failureThreshold: this.options.failureThreshold,
      resetTimeout: this.options.resetTimeout,
      monitoringPeriod: this.options.monitoringPeriod
    });
  }

  private validateOptions(): void {
    if (this.options.failureThreshold <= 0) {
      throw new Error('failureThreshold must be greater than 0');
    }
    if (this.options.resetTimeout <= 0) {
      throw new Error('resetTimeout must be greater than 0');
    }
    if (this.options.monitoringPeriod <= 0) {
      throw new Error('monitoringPeriod must be greater than 0');
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        logger.info('Circuit breaker transitioning to half-open', {
          name: this.name,
          lastFailureTime: this.lastFailureTime,
          failureCount: this.failureCount
        });
      } else {
        logger.warn('Circuit breaker is open, failing fast', {
          name: this.name,
          state: this.state,
          failureCount: this.failureCount,
          timeUntilReset: this.getTimeUntilReset()
        });
        throw new CircuitBreakerError(
          `Circuit breaker is ${this.state} for ${this.name}`,
          this.state
        );
      }
    }

    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.options.timeout) {
      return await fn();
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Request timeout after ${this.options.timeout}ms`));
      }, this.options.timeout);

      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer));
    });
  }

  private onSuccess(): void {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      logger.info('Circuit breaker success in half-open state', {
        name: this.name,
        successCount: this.successCount
      });

      // Require multiple successes to fully close the circuit
      if (this.successCount >= Math.ceil(this.options.failureThreshold / 2)) {
        this.reset();
        logger.info('Circuit breaker closed after successful recovery', {
          name: this.name,
          successCount: this.successCount
        });
      }
    }

    this.clearOldFailures();
  }

  private onFailure(error: any): void {
    if (this.shouldCountFailure(error)) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      logger.warn('Circuit breaker recorded failure', {
        name: this.name,
        failureCount: this.failureCount,
        error: error.message,
        state: this.state
      });

      if (this.state === CircuitBreakerState.HALF_OPEN) {
        // If we fail in half-open state, immediately go back to open
        this.state = CircuitBreakerState.OPEN;
        this.successCount = 0;
        logger.warn('Circuit breaker reopened after failure in half-open state', {
          name: this.name
        });
      } else if (this.failureCount >= this.options.failureThreshold) {
        this.state = CircuitBreakerState.OPEN;
        logger.error('Circuit breaker opened due to failure threshold', {
          name: this.name,
          failureCount: this.failureCount,
          threshold: this.options.failureThreshold
        });
      }
    }
  }

  private shouldCountFailure(error: any): boolean {
    // If specific error types are configured, only count those
    if (this.options.expectedErrors && this.options.expectedErrors.length > 0) {
      return this.options.expectedErrors.some(errorType => 
        error.name === errorType || error.constructor.name === errorType
      );
    }

    // By default, count all errors except circuit breaker errors
    return !(error instanceof CircuitBreakerError);
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.options.resetTimeout;
  }

  private clearOldFailures(): void {
    const now = Date.now();
    if (now - this.lastFailureTime >= this.options.monitoringPeriod) {
      this.failureCount = 0;
    }
  }

  private getTimeUntilReset(): number {
    return Math.max(0, this.options.resetTimeout - (Date.now() - this.lastFailureTime));
  }

  private reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }

  // Public methods for monitoring
  getState(): CircuitBreakerState {
    return this.state;
  }

  getStats() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      timeUntilReset: this.state === CircuitBreakerState.OPEN ? this.getTimeUntilReset() : 0
    };
  }

  isOpen(): boolean {
    return this.state === CircuitBreakerState.OPEN;
  }

  isClosed(): boolean {
    return this.state === CircuitBreakerState.CLOSED;
  }

  isHalfOpen(): boolean {
    return this.state === CircuitBreakerState.HALF_OPEN;
  }

  // Force state changes (for testing or manual intervention)
  forceOpen(): void {
    this.state = CircuitBreakerState.OPEN;
    logger.warn('Circuit breaker manually forced open', { name: this.name });
  }

  forceClose(): void {
    this.reset();
    logger.info('Circuit breaker manually forced closed', { name: this.name });
  }
}

// Factory for creating commonly configured circuit breakers
export class CircuitBreakerFactory {
  static createDefault(name: string, options: Partial<CircuitBreakerOptions> = {}): CircuitBreaker {
    const defaultOptions: CircuitBreakerOptions = {
      failureThreshold: 5,
      resetTimeout: 60000,      // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      timeout: 5000,            // 5 seconds
      name,
      ...options
    };

    return new CircuitBreaker(defaultOptions);
  }

  static createForDatabase(name: string = 'database'): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000,      // 30 seconds
      monitoringPeriod: 180000, // 3 minutes
      timeout: 10000,           // 10 seconds
      name,
      expectedErrors: ['DatabaseError', 'ConnectionError', 'TimeoutError']
    });
  }

  static createForExternalAPI(name: string, timeout: number = 5000): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 120000,     // 2 minutes
      monitoringPeriod: 600000, // 10 minutes
      timeout,
      name,
      expectedErrors: ['NetworkError', 'TimeoutError', 'HTTPError']
    });
  }

  static createForCriticalService(name: string): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 2,      // Very low threshold
      resetTimeout: 300000,     // 5 minutes
      monitoringPeriod: 900000, // 15 minutes
      timeout: 3000,            // 3 seconds
      name
    });
  }
}