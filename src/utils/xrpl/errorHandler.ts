import type { TxResponse } from "xrpl";

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
 * Handle AMM deposit errors with specific guidance
 */
export function handleAMMDepositError(error: any): ErrorResult {
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
 * Get transaction result from TxResponse (confirmed transaction result)
 */
export function getTransactionResult(response: TxResponse): string {
  if (typeof response.result.meta === 'string') {
    return 'UNKNOWN_ERROR';
  }
  return response.result.meta?.TransactionResult || 'UNKNOWN_ERROR';
}

/**
 * Check if a TxResponse indicates success
 */
export function isTransactionSuccessful(response: TxResponse): boolean {
  return getTransactionResult(response) === 'tesSUCCESS';
}

