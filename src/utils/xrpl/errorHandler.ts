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
} as const;

export type ErrorType = typeof ErrorTypes[keyof typeof ErrorTypes];

/**
 * AMM Deposit-specific error codes and messages
 */
export const AMMDepositErrorCodes = {
  tecAMM_EMPTY: "The AMM currently holds no assets, so you cannot do a normal deposit. You must use the Empty AMM Special Case deposit instead.",
  tecAMM_NOT_EMPTY: "The transaction specified tfTwoAssetIfEmpty, but the AMM was not empty.",
  tecAMM_FAILED: "The conditions on the deposit could not be satisfied. For example, the requested effective price in the EPrice field is too low.",
  tecFROZEN: "The transaction tried to deposit a frozen token, or at least one of the paired tokens is frozen.",
  tecINSUF_RESERVE_LINE: "The sender of this transaction does not meet the increased reserve requirement of processing this transaction, probably because they need a new trust line to hold the LP Tokens, and they don't have enough XRP to meet the additional owner reserve for a new trust line.",
  tecUNFUNDED_AMM: "The sender does not have a high enough balance to make the specified deposit.",
  temBAD_AMM_TOKENS: "The transaction specified the LP Tokens incorrectly. For example, the issuer is not the AMM's associated AccountRoot address or the currency is not the currency code for this AMM's LP Tokens, or the transaction specified this AMM's LP Tokens in one of the asset fields.",
  temBAD_AMOUNT: "An amount specified in the transaction is invalid. For example, a deposit amount is negative.",
  temBAD_FEE: "A fee value specified in the transaction is invalid. For example, the trading fee is outside the allowable range.",
  temMALFORMED: "The transaction specified an invalid combination of fields. See AMMDeposit Modes.",
  terNO_ACCOUNT: "An account specified in the request does not exist.",
  terNO_AMM: "The Automated Market Maker instance for the asset pair in this transaction does not exist."
} as const;

/**
 * AMM Withdrawal-specific error codes and messages
 */
export const AMMWithdrawErrorCodes = {
  tecAMM_EMPTY: "The AMM has no assets in its pool. In this state, you can only delete the AMM or fund it with a new deposit.",
  tecAMM_BALANCE: "The transaction would withdraw all of one asset from the pool, or rounding would cause a 'withdraw all' to leave a nonzero amount behind.",
  tecAMM_FAILED: "The conditions on the withdrawal could not be satisfied; for example, the requested effective price in the EPrice field is too low.",
  tecAMM_INVALID_TOKENS: "The AMM for this token pair does not exist, or one of the calculations resulted in a withdrawal amount rounding to zero.",
  tecFROZEN: "The transaction tried to withdraw a frozen token.",
  tecINSUF_RESERVE_LINE: "The sender of this transaction does not meet the increased reserve requirement of processing this transaction, probably because they need at least one new trust line to hold one of the assets to be withdrawn, and they don't have enough XRP to meet the additional owner reserve for a new trust line.",
  tecUNFUNDED_AMM: "The sender does not have enough LP Tokens to make the specified withdrawal.",
  temBAD_AMM_TOKENS: "The transaction specified the LP Tokens incorrectly.",
  temBAD_AMOUNT: "An amount specified in the transaction is invalid.",
  temMALFORMED: "The transaction specified an invalid combination of fields.",
  terNO_ACCOUNT: "An account specified in the request does not exist.",
  terNO_AMM: "The Automated Market Maker instance for the asset pair in this transaction does not exist."
} as const;

// Type definitions
export interface ErrorContext {
  operation: string;
  attempt: number;
  maxRetries: number;
  error: any;
  metadata?: Record<string, any>;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

export interface ErrorResult {
  success: false;
  error: string;
  errorType: ErrorType;
  context?: ErrorContext;
  canRetry?: boolean;
}

export interface SuccessResult<T = any> {
  success: true;
  data: T;
}

export type Result<T = any> = SuccessResult<T> | ErrorResult;

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2
};

/**
 * Enhanced error classification with detailed context
 */
export function classifyError(error: any, operation: string = 'unknown'): { type: ErrorType; message: string; canRetry: boolean } {
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  
  // Network-related errors
  if (errorMessage.includes('network') || 
      errorMessage.includes('connection') || 
      errorMessage.includes('timeout') ||
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('ECONNREFUSED')) {
    return {
      type: ErrorTypes.NETWORK,
      message: `Network error during ${operation}: ${errorMessage}`,
      canRetry: true
    };
  }
  
  // Timeout errors
  if (errorMessage.includes('timeout') || error?.code === 'ETIMEDOUT') {
    return {
      type: ErrorTypes.TIMEOUT,
      message: `Timeout error during ${operation}: ${errorMessage}`,
      canRetry: true
    };
  }
  
  // Rate limiting
  if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
    return {
      type: ErrorTypes.RATE_LIMIT,
      message: `Rate limit exceeded during ${operation}: ${errorMessage}`,
      canRetry: true
    };
  }
  
  // Insufficient funds
  if (errorMessage.includes('insufficient') || 
      errorMessage.includes('unfunded') ||
      errorMessage.includes('tecUNFUNDED')) {
    return {
      type: ErrorTypes.INSUFFICIENT_FUNDS,
      message: `Insufficient funds for ${operation}: ${errorMessage}`,
      canRetry: false
    };
  }
  
  // Validation errors
  if (errorMessage.includes('invalid') || 
      errorMessage.includes('malformed') ||
      errorMessage.includes('temMALFORMED') ||
      errorMessage.includes('temBAD')) {
    return {
      type: ErrorTypes.VALIDATION,
      message: `Validation error during ${operation}: ${errorMessage}`,
      canRetry: false
    };
  }
  
  // AMM-specific errors
  if (errorMessage.includes('AMM') || 
      errorMessage.includes('tecAMM') ||
      errorMessage.includes('terNO_AMM')) {
    return {
      type: ErrorTypes.AMM,
      message: `AMM error during ${operation}: ${errorMessage}`,
      canRetry: false
    };
  }
  
  // Transaction errors
  if (errorMessage.includes('tec') || 
      errorMessage.includes('tem') ||
      errorMessage.includes('ter') ||
      errorMessage.includes('transaction')) {
    return {
      type: ErrorTypes.TRANSACTION,
      message: `Transaction error during ${operation}: ${errorMessage}`,
      canRetry: false
    };
  }
  
  // Pathfinding errors
  if (errorMessage.includes('path') || errorMessage.includes('pathfind')) {
    return {
      type: ErrorTypes.PATHFINDING,
      message: `Pathfinding error during ${operation}: ${errorMessage}`,
      canRetry: true
    };
  }
  
  // Default to unknown
  return {
    type: ErrorTypes.UNKNOWN,
    message: `Unknown error during ${operation}: ${errorMessage}`,
    canRetry: true
  };
}

/**
 * Exponential backoff delay calculation
 */
export function calculateDelay(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  const delay = Math.min(
    config.baseDelay * Math.pow(config.backoffFactor, attempt),
    config.maxDelay
  );
  
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * delay;
  return Math.floor(delay + jitter);
}

/**
 * Sleep utility for delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Enhanced retry wrapper with exponential backoff and detailed logging
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string = 'operation',
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  metadata?: Record<string, any>
): Promise<Result<T>> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempting ${operationName} (attempt ${attempt + 1}/${config.maxRetries + 1})`);
      
      const result = await operation();
      
      if (attempt > 0) {
        console.log(`✅ ${operationName} succeeded after ${attempt + 1} attempts`);
      }
      
      return { success: true, data: result };
      
    } catch (error) {
      lastError = error;
      const classification = classifyError(error, operationName);
      
      const context: ErrorContext = {
        operation: operationName,
        attempt: attempt + 1,
        maxRetries: config.maxRetries,
        error: error,
        metadata
      };
      
      console.error(`❌ ${operationName} failed (attempt ${attempt + 1}):`, {
        error: classification.message,
        type: classification.type,
        canRetry: classification.canRetry,
        context
      });
      
      // Don't retry if it's the last attempt or error is not retryable
      if (attempt >= config.maxRetries || !classification.canRetry) {
        return {
          success: false,
          error: classification.message,
          errorType: classification.type,
          context,
          canRetry: classification.canRetry
        };
      }
      
      // Calculate delay and wait before retry
      const delay = calculateDelay(attempt, config);
      console.log(`⏳ Retrying ${operationName} in ${delay}ms...`);
      await sleep(delay);
    }
  }
  
  // This should never be reached, but just in case
  const classification = classifyError(lastError, operationName);
  return {
    success: false,
    error: classification.message,
    errorType: classification.type,
    canRetry: false
  };
}

/**
 * Specific error handlers for common XRPL operations
 */
export class XRPLErrorHandler {
  
  /**
   * Handle AMM deposit errors with specific guidance
   */
  static handleAMMDepositError(error: any): ErrorResult {
    const errorCode = error?.engine_result || error?.code;
    const specificMessage = AMMDepositErrorCodes[errorCode as keyof typeof AMMDepositErrorCodes];
    
    if (specificMessage) {
      return {
        success: false,
        error: `AMM Deposit Failed: ${specificMessage}`,
        errorType: ErrorTypes.AMM,
        canRetry: false
      };
    }
    
    const classification = classifyError(error, 'AMM Deposit');
    return {
      success: false,
      error: classification.message,
      errorType: classification.type,
      canRetry: classification.canRetry
    };
  }
  
  /**
   * Handle AMM withdrawal errors with specific guidance
   */
  static handleAMMWithdrawError(error: any): ErrorResult {
    const errorCode = error?.engine_result || error?.code;
    const specificMessage = AMMWithdrawErrorCodes[errorCode as keyof typeof AMMWithdrawErrorCodes];
    
    if (specificMessage) {
      return {
        success: false,
        error: `AMM Withdrawal Failed: ${specificMessage}`,
        errorType: ErrorTypes.AMM,
        canRetry: false
      };
    }
    
    const classification = classifyError(error, 'AMM Withdrawal');
    return {
      success: false,
      error: classification.message,
      errorType: classification.type,
      canRetry: classification.canRetry
    };
  }
  
  /**
   * Handle transaction submission errors
   */
  static handleTransactionError(error: any, transactionType: string = 'transaction'): ErrorResult {
    const classification = classifyError(error, transactionType);
    
    // Provide more specific guidance for common transaction errors
    if (classification.type === ErrorTypes.INSUFFICIENT_FUNDS) {
      return {
        success: false,
        error: `Insufficient funds for ${transactionType}. Please check your balance and try again.`,
        errorType: ErrorTypes.INSUFFICIENT_FUNDS,
        canRetry: false
      };
    }
    
    return {
      success: false,
      error: classification.message,
      errorType: classification.type,
      canRetry: classification.canRetry
    };
  }
}

/**
 * Graceful error wrapper for API responses
 */
export function wrapApiError<T>(result: Result<T>): { success: boolean; data?: T; error?: string; errorType?: ErrorType } {
  if (result.success) {
    return {
      success: true,
      data: result.data
    };
  }
  
  // Type assertion since we know it's ErrorResult when success is false
  const errorResult = result as ErrorResult;
  return {
    success: false,
    error: errorResult.error,
    errorType: errorResult.errorType
  };
}

/**
 * Log error with context for debugging
 */
export function logError(error: any, context: string, metadata?: Record<string, any>): void {
  const classification = classifyError(error, context);
  
  console.error(`🚨 Error in ${context}:`, {
    message: classification.message,
    type: classification.type,
    canRetry: classification.canRetry,
    originalError: error,
    metadata,
    timestamp: new Date().toISOString()
  });
}
