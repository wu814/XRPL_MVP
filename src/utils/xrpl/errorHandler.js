import xrpl from "xrpl";

/**
 * Enhanced Error Handling & Retry Logic System
 * Provides robust error handling, retry mechanisms, and graceful failures
 */

/**
 * Error types for classification
 */
export const ErrorTypes = {
  NETWORK: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT_ERROR', 
  VALIDATION: 'VALIDATION_ERROR',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  PATHFINDING: 'PATHFINDING_ERROR',
  AMM: 'AMM_ERROR',
  TRANSACTION: 'TRANSACTION_ERROR',
  RATE_LIMIT: 'RATE_LIMIT_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
};

/**
 * Retry configurations for different operation types
 */
export const RetryConfigs = {
  NETWORK_REQUEST: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryableErrors: [ErrorTypes.NETWORK, ErrorTypes.TIMEOUT, ErrorTypes.RATE_LIMIT]
  },
  TRANSACTION_SUBMIT: {
    maxRetries: 5,
    baseDelay: 2000,
    maxDelay: 30000,
    backoffMultiplier: 1.5,
    retryableErrors: [ErrorTypes.NETWORK, ErrorTypes.TIMEOUT, ErrorTypes.RATE_LIMIT]
  },
  AMM_DATA_FETCH: {
    maxRetries: 2,
    baseDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 2,
    retryableErrors: [ErrorTypes.NETWORK, ErrorTypes.TIMEOUT, ErrorTypes.AMM]
  },
  PATHFINDING: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 8000,
    backoffMultiplier: 2,
    retryableErrors: [ErrorTypes.NETWORK, ErrorTypes.PATHFINDING]
  }
};

/**
 * Enhanced error class with context and classification
 */
export class EnhancedError extends Error {
  constructor(message, type = ErrorTypes.UNKNOWN, context = {}, originalError = null) {
    super(message);
    this.name = 'EnhancedError';
    this.type = type;
    this.context = context;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
    this.retryable = this.isRetryable();
  }

  isRetryable() {
    const retryableTypes = [
      ErrorTypes.NETWORK,
      ErrorTypes.TIMEOUT,
      ErrorTypes.RATE_LIMIT,
      ErrorTypes.AMM
    ];
    return retryableTypes.includes(this.type);
  }

  toJSON() {
    return {
      message: this.message,
      type: this.type,
      context: this.context,
      timestamp: this.timestamp,
      retryable: this.retryable,
      originalError: this.originalError?.message
    };
  }
}

/**
 * Classify errors based on error messages and codes
 */
function classifyError(error) {
  const message = error.message?.toLowerCase() || '';
  const code = error.code;
  
  // Network errors
  if (message.includes('network') || message.includes('connection') || 
      message.includes('enotfound') || message.includes('econnrefused') ||
      code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ECONNRESET') {
    return ErrorTypes.NETWORK;
  }
  
  // Timeout errors
  if (message.includes('timeout') || message.includes('timed out') ||
      code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
    return ErrorTypes.TIMEOUT;
  }
  
  // Rate limiting
  if (message.includes('rate limit') || message.includes('too many requests') ||
      error.status === 429) {
    return ErrorTypes.RATE_LIMIT;
  }
  
  // XRPL specific errors
  if (message.includes('tecpath') || message.includes('pathfinding')) {
    return ErrorTypes.PATHFINDING;
  }
  
  if (message.includes('tecunfunded') || message.includes('insufficient')) {
    return ErrorTypes.INSUFFICIENT_FUNDS;
  }
  
  if (message.includes('amm') && (message.includes('not found') || message.includes('invalid'))) {
    return ErrorTypes.AMM;
  }
  
  // Transaction errors
  if (message.includes('transaction') && (message.includes('failed') || message.includes('invalid'))) {
    return ErrorTypes.TRANSACTION;
  }
  
  // Validation errors
  if (message.includes('validation') || message.includes('invalid') || 
      message.includes('malformed') || error.name === 'ValidationError') {
    return ErrorTypes.VALIDATION;
  }
  
  return ErrorTypes.UNKNOWN;
}

/**
 * Create enhanced error from regular error
 */
export function createEnhancedError(error, context = {}) {
  const type = classifyError(error);
  const message = error.message || 'Unknown error occurred';
  
  return new EnhancedError(message, type, context, error);
}

/**
 * Retry wrapper with exponential backoff and jitter
 */
export async function withRetry(operation, config = RetryConfigs.NETWORK_REQUEST, context = {}) {
  const { maxRetries, baseDelay, maxDelay, backoffMultiplier, retryableErrors } = config;
  
  let lastError;
  let attempt = 0;
  
  while (attempt <= maxRetries) {
    try {
      console.log(`🔄 Attempt ${attempt + 1}/${maxRetries + 1}: ${context.operation || 'Operation'}`);
      
      const result = await operation();
      
      if (attempt > 0) {
        console.log(`✅ Success after ${attempt + 1} attempts`);
      }
      
      return result;
      
    } catch (error) {
      attempt++;
      lastError = createEnhancedError(error, { ...context, attempt });
      
      console.warn(`❌ Attempt ${attempt} failed: ${lastError.message}`);
      
      // Don't retry if error is not retryable
      if (!retryableErrors.includes(lastError.type)) {
        console.log(`🚫 Error type ${lastError.type} is not retryable`);
        throw lastError;
      }
      
      // Don't retry if we've exceeded max attempts
      if (attempt > maxRetries) {
        console.error(`🚫 Max retries (${maxRetries}) exceeded`);
        throw lastError;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        baseDelay * Math.pow(backoffMultiplier, attempt - 1),
        maxDelay
      );
      
      // Add jitter (±25% randomness)
      const jitter = delay * 0.25 * (Math.random() * 2 - 1);
      const finalDelay = Math.max(100, delay + jitter);
      
      console.log(`⏳ Retrying in ${Math.round(finalDelay)}ms...`);
      await sleep(finalDelay);
    }
  }
  
  throw lastError;
}

/**
 * Timeout wrapper for operations
 */
export async function withTimeout(operation, timeoutMs = 30000, context = {}) {
  return new Promise(async (resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const error = new EnhancedError(
        `Operation timed out after ${timeoutMs}ms`,
        ErrorTypes.TIMEOUT,
        { ...context, timeoutMs }
      );
      reject(error);
    }, timeoutMs);
    
    try {
      const result = await operation();
      clearTimeout(timeoutId);
      resolve(result);
    } catch (error) {
      clearTimeout(timeoutId);
      reject(createEnhancedError(error, context));
    }
  });
}

/**
 * Circuit breaker for failing operations
 */
export class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }
  
  async execute(operation, context = {}) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
        console.log(`🔄 Circuit breaker moving to HALF_OPEN state`);
      } else {
        throw new EnhancedError(
          'Circuit breaker is OPEN - operation blocked',
          ErrorTypes.NETWORK,
          { ...context, circuitState: this.state }
        );
      }
    }
    
    try {
      const result = await operation();
      
      if (this.state === 'HALF_OPEN') {
        this.reset();
        console.log(`✅ Circuit breaker reset to CLOSED state`);
      }
      
      return result;
      
    } catch (error) {
      this.recordFailure();
      throw createEnhancedError(error, { ...context, circuitState: this.state });
    }
  }
  
  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      console.warn(`🚨 Circuit breaker OPENED after ${this.failureCount} failures`);
    }
  }
  
  reset() {
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED';
  }
}

/**
 * Global circuit breakers for different services
 */
export const circuitBreakers = {
  xrpl: new CircuitBreaker(5, 60000),
  amm: new CircuitBreaker(3, 30000),
  pathfinding: new CircuitBreaker(4, 45000)
};

/**
 * Enhanced XRPL client request with full error handling
 */
export async function safeXrplRequest(client, request, context = {}) {
  return await withRetry(
    async () => {
      return await withTimeout(
        async () => {
          return await circuitBreakers.xrpl.execute(
            async () => {
              return await client.request(request);
            },
            { ...context, service: 'xrpl' }
          );
        },
        30000,
        { ...context, operation: 'xrpl_request' }
      );
    },
    RetryConfigs.NETWORK_REQUEST,
    { ...context, operation: 'safe_xrpl_request' }
  );
}

/**
 * Enhanced transaction submission with comprehensive error handling
 */
export async function safeTransactionSubmit(client, signedTx, context = {}) {
  return await withRetry(
    async () => {
      return await withTimeout(
        async () => {
          return await circuitBreakers.xrpl.execute(
            async () => {
              const response = await client.submitAndWait(signedTx);
              
              // Check transaction result
              if (response.result.meta.TransactionResult !== "tesSUCCESS") {
                const txResult = response.result.meta.TransactionResult;
                
                // Classify transaction error
                let errorType = ErrorTypes.TRANSACTION;
                if (txResult.includes('tecPATH') || txResult.includes('tecNO_PATH')) {
                  errorType = ErrorTypes.PATHFINDING;
                } else if (txResult.includes('tecUNFUNDED')) {
                  errorType = ErrorTypes.INSUFFICIENT_FUNDS;
                }
                
                throw new EnhancedError(
                  `Transaction failed: ${txResult}`,
                  errorType,
                  { ...context, transactionResult: txResult }
                );
              }
              
              return response;
            },
            { ...context, service: 'transaction' }
          );
        },
        45000, // Longer timeout for transactions
        { ...context, operation: 'transaction_submit' }
      );
    },
    RetryConfigs.TRANSACTION_SUBMIT,
    { ...context, operation: 'safe_transaction_submit' }
  );
}

// REMOVED: AMM-specific error handling - use general safeXrplRequest instead

/**
 * Sleep utility
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Graceful error reporting
 */
export function reportError(error, context = {}) {
  const enhancedError = error instanceof EnhancedError ? error : createEnhancedError(error, context);
  
  console.error(`🚨 Error Report:`);
  console.error(`   Type: ${enhancedError.type}`);
  console.error(`   Message: ${enhancedError.message}`);
  console.error(`   Retryable: ${enhancedError.retryable}`);
  console.error(`   Context: ${JSON.stringify(enhancedError.context, null, 2)}`);
  console.error(`   Timestamp: ${enhancedError.timestamp}`);
  
  // Log original error stack for debugging
  if (enhancedError.originalError && enhancedError.originalError.stack) {
    console.error(`   Stack: ${enhancedError.originalError.stack}`);
  }
  
  return enhancedError;
} 