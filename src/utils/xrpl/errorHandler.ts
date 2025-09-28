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

  // Get transaction type from multiple possible locations
  let transactionType = "Unknown";
  if (response.result.tx_json?.TransactionType) {
    transactionType = response.result.tx_json.TransactionType;
  } else if (
    "TransactionType" in response.result &&
    typeof response.result.TransactionType === "string"
  ) {
    transactionType = response.result.TransactionType;
  } else if (response.result.meta && typeof response.result.meta === "object") {
    // Try to infer from metadata if available
    transactionType = "Transaction"; // Generic fallback
  }

  // Transaction-specific error handling
  const errorInfo = getTransactionErrorInfo(
    transactionType,
    transactionResult,
    operation,
  );

  return {
    code: transactionResult,
    message: errorInfo.message,
  };
}

/**
 * Get transaction-specific error information
 */
function getTransactionErrorInfo(
  transactionType: string,
  resultCode: string,
  operation: string,
): { message: string } {
  const errorMessages: Record<string, Record<string, string>> = {
    AccountSet: {
      tecNO_PERMISSION: "You do not have permission to perform this operation",
      tecINSUFFICIENT_RESERVE: "Insufficient reserve to perform this operation",
      tecUNFUNDED_PAYMENT: "Account has insufficient funds",
      tecOWNERS: "Cannot remove the last signer",
      tecMASTER_DISABLED: "Master key is disabled",
      tecNO_REGULAR_KEY: "Regular key is not set",
      tecFROZEN: "Account is frozen",
    },
    Payment: {
      tecPATH_DRY: "The transaction failed because the provided paths did not have enough liquidity to send anything at all. This could mean that the source and destination accounts are not linked by trust lines.",
      tecPATH_PARTIAL: "Path could not send full amount, try adding 1% slippage",
      tecUNFUNDED_PAYMENT: "Insufficient funds for payment",
      tecNO_LINE: "No trust line for this asset",
      tecFROZEN: "Asset is frozen",
    },
    OfferCreate: {
      tecUNFUNDED: "Insufficient funds to create offer",
      tecFROZEN: "Asset is frozen",
      tecNO_LINE: "No trust line for this asset",
      tecINSUFFICIENT_RESERVE: "Insufficient reserve for offer",
    },
    AMMCreate: {
      tecAMM_ALREADY_EXISTS: "AMM for this asset pair already exists",
      tecINSUFFICIENT_FUNDS: "Insufficient funds to create AMM",
      tecFROZEN: "One or more assets are frozen",
      tecNO_LINE: "Trust line does not exist for one of the assets",
    },
    AMMDeposit: {
      tecAMM_EMPTY: "AMM is empty, use special case deposit",
      tecAMM_FAILED: "Deposit conditions could not be satisfied, try adding 1% slippage",
      tecFROZEN: "Transaction tried to deposit a frozen token",
      tecINSUF_RESERVE_LINE: "Insufficient reserve for new trust line",
    },
    AMMWithdraw: {
      tecAMM_EMPTY: "AMM has no assets in its pool",
      tecAMM_BALANCE: "Would withdraw all of one asset from pool",
      tecAMM_FAILED: "Withdrawal conditions could not be satisfied",
      tecFROZEN: "Transaction tried to withdraw a frozen token",
    },
    TrustSet: {
      tecNO_LINE: "No trust line exists",
      tecINSUFFICIENT_RESERVE: "Insufficient reserve for trust line",
      tecFROZEN: "Cannot set trust line on frozen asset",
    },
    NFTokenMint: {
      tecNO_LINE: "No trust line for this NFT",
      tecINSUFFICIENT_RESERVE: "Insufficient reserve for NFT",
      tecFROZEN: "Cannot mint frozen NFT",
    },
  };

  // Get transaction-specific error message
  const transactionErrors = errorMessages[transactionType];
  if (transactionErrors && transactionErrors[resultCode]) {
    return {
      message: `${operation} failed with code: ${resultCode} - ${transactionErrors[resultCode]}`,
    };
  }

  // Generic error message
  return {
    message: `${operation} failed with code: ${resultCode}`,
  };
}
