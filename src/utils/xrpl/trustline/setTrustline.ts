// Change this file when there are more than 1 issuer wallet
import { client, connectXRPLClient } from "../testnet";
import { Wallet, AccountLinesResponse, TrustSet } from "xrpl";
import { SetLPTrustlineParams, SetTrustlineResult } from "@/types/xrpl/trustlineXRPLTypes";
import { isTypedTransactionSuccessful, handleTransactionError } from "../errorHandler";



export async function setTrustline(
  setterXRPLWallet: Wallet,
  issuerWalletAddress: string,
  currency: string,
): Promise<SetTrustlineResult> {
  try {
    await connectXRPLClient();
    const MAX_TRUST_LIMIT = "1000000000000000";

    // Check if trustline already exists before creating a new one
    const existingTrustline = await checkTrustline(
      setterXRPLWallet.classicAddress,
      issuerWalletAddress,
      currency,
    );

    if (existingTrustline) {
      console.log("ℹ️ Trustline already exists, skipping creation.");
      return {
        success: true,
        message: `Trustline already exists between ${setterXRPLWallet.classicAddress} and ${issuerWalletAddress} for ${currency}. No action needed.`,
      };
    }

    // Build the TrustSet transaction with the determined currency.
    const trustSetTx: TrustSet = {
      TransactionType: "TrustSet",
      Account: setterXRPLWallet.classicAddress,
      LimitAmount: {
        currency: currency,
        issuer: issuerWalletAddress,
        value: MAX_TRUST_LIMIT,
      },
    };

    const preparedTx = await client.autofill(trustSetTx);
    const signedTx = setterXRPLWallet.sign(preparedTx);
    const result = await client.submitAndWait<TrustSet>(signedTx.tx_blob);

    // Use the error handling helper functions
    if (!isTypedTransactionSuccessful(result)) {
      const errorInfo = handleTransactionError(result, "setTrustline");
      return {
        success: false,
        errorCode: errorInfo.code,
        message: errorInfo.message,
      };
    }

    const trustlineMsg = `Trustline set from 
${setterXRPLWallet.classicAddress}
to 
${issuerWalletAddress} 
for ${currency}.`;

    return {
      success: true,
      message: trustlineMsg,
    };

  } catch (error) {
    // Re-throw system errors with context
    throw new Error(`Failed to set trustline: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function checkTrustline(
  walletAddress: string, 
  destination: string, 
  currency: string
): Promise<boolean> {
  await connectXRPLClient();

  console.log(
    `🔍 Checking trustline for ${walletAddress} to ${destination} for ${currency}...`,
  );

  // Check if the wallet has a trustline to the destination (issuer)
  const trustlineResponse: AccountLinesResponse = await client.request({
    command: "account_lines",
    account: walletAddress,
    peer: destination,
  });

  const hasTrustline = trustlineResponse.result.lines.some(
    (line) => line.currency === currency,
  );

  if (!hasTrustline) {
    console.log(
      `ℹ️ No trustline found from ${walletAddress} to ${destination} for ${currency}.`,
    );
    return false;
  }

  console.log(
    `✅ Trustline found from ${walletAddress} to ${destination} for ${currency}.`,
  );

  // Check if the issuer (destination) has RequireAuth flag set
  const issuerAccountInfo = await client.request({
    command: "account_info",
    account: destination,
    ledger_index: "validated",
  });

  const issuerFlags = Number(issuerAccountInfo.result.account_data.Flags);
  // asfRequireAuth flag is 0x00040000 (bit 2) = 262144 in decimal
  const hasRequireAuth = (issuerFlags & 0x00040000) !== 0;

  if (!hasRequireAuth) {
    // If issuer doesn't have RequireAuth, just having the trustline is enough
    console.log(
      `✅ Issuer does not require authorization. Trustline is ready to use.`,
    );
    return true;
  }

  console.log(
    `🔍 Issuer requires authorization. Checking if issuer has authorized the trustline...`,
  );

  // Check if the issuer has authorized the trustline (by setting a reciprocal trustline)
  const issuerTrustlineResponse: AccountLinesResponse = await client.request({
    command: "account_lines",
    account: destination,
    peer: walletAddress,
  });

  const issuerHasAuthorized = issuerTrustlineResponse.result.lines.some(
    (line) => line.currency === currency,
  );

  if (issuerHasAuthorized) {
    console.log(
      `✅ Trustline is fully authorized. Both sides exist between ${walletAddress} and ${destination} for ${currency}.`,
    );
    return true;
  } else {
    console.log(
      `⚠️ Trustline exists but is NOT authorized by issuer.`,
    );
    console.log(
      `   User (${walletAddress}) has set trustline to issuer (${destination})`,
    );
    console.log(
      `   BUT issuer has NOT authorized it yet for ${currency}.`,
    );
    console.log(
      `   The issuer must use "Authorize Trustline" to complete the setup.`,
    );
    return false;
  }
}

export async function setLPTrustlineFromAMMData(
  { setterXRPLWallet, lpToken }: SetLPTrustlineParams,
): Promise<SetTrustlineResult | undefined> {
  await connectXRPLClient();

  if (!lpToken) {
    throw new Error("❌ LP token must be specified to set up LP trustline.");
  }

  console.log(
    `🔹 Setting up LP trustline for wallet ${setterXRPLWallet.classicAddress} to AMM ${lpToken.issuer}`,
  );

  const result = await setTrustline(
    setterXRPLWallet,
    lpToken.issuer,
    lpToken.currency,
  );

  if (!result?.success) {
    return {
      success: false,
      message: result.message,
      errorCode: result.errorCode,
    }
  }

  return {
    success: true,
    message: result.message,
  };
}
