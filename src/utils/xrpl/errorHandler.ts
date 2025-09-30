import type { TxResponse, SubmittableTransaction } from "xrpl";


/**
 * Generic transaction result checker with type safety
 */
export function getTypedTransactionResult<T extends SubmittableTransaction>(
  response: TxResponse<T>,
): string {
  if (typeof response.result.meta === "string") {
    return "UNKNOWN_ERROR";
  }
  return response.result.meta?.TransactionResult || "UNKNOWN_ERROR";
}

/**
 * Generic transaction success checker with type safety
 */
export function isTypedTransactionSuccessful<T extends SubmittableTransaction>(
  response: TxResponse<T>,
): boolean {
  return getTypedTransactionResult(response) === "tesSUCCESS";
}

/**
 * Enhanced transaction error handler with transaction-specific logic
 */
export function handleTransactionError<T extends SubmittableTransaction>(
  response: TxResponse<T>,
  operation: string,
): { code: string; message: string; } {
  const transactionResult = getTypedTransactionResult(response);

  const errorMessage = `${operation} failed with Code: ${transactionResult}`;

  return {
    code: transactionResult,
    message: errorMessage,
  };
}
