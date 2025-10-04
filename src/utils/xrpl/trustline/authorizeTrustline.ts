import { client, connectXRPLClient } from "../testnet";
import * as xrpl from "xrpl";
import { isTypedTransactionSuccessful, handleTransactionError } from "../errorHandler";

interface AuthorizeTrustlineResult {
  success: boolean;
  message: string;
  errorCode?: string;
}

/**
 * Authorize a specific address to establish a trustline with the issuer wallet
 * In XRPL, when an issuer has asfRequireAuth flag set, they must authorize trustlines 
 * by setting a reciprocal trustline with a limit > 0 from the issuer to the user
 * 
 * @param issuerWallet - Issuer wallet that will authorize the trustline
 * @param trustlineAddress - Address to authorize for trustline creation
 * @param currency - Currency code for the trustline
 * @returns Success message
 */
export async function authorizeTrustline(
  issuerWallet: xrpl.Wallet,
  trustlineAddress: string,
  currency: string,
): Promise<AuthorizeTrustlineResult> {
  try {
    await connectXRPLClient();

    // First, check if the user has already created a trustline to the issuer
    const accountLines = await client.request({
      command: "account_lines",
      account: trustlineAddress,
      peer: issuerWallet.classicAddress,
      ledger_index: "validated",
    });

    const existingTrustline = accountLines.result.lines.find(
      (line) => line.currency === currency
    );

    if (!existingTrustline) {
      return {
        success: false,
        message: `No trustline request found from ${trustlineAddress} for ${currency}. The user must create a trustline first.`,
      };
    }

    console.log(`✅ Found trustline request from ${trustlineAddress} for ${currency}`);

    // The issuer authorizes the trustline by setting the tfSetfAuth flag
    // This sets the authorization bit on the EXISTING trustline created by the user
    // The issuer specifies the trustline by pointing to the user as the "issuer" in LimitAmount
    // (this is counterintuitive but correct - it identifies which trustline to authorize)
    const trustSetTx: xrpl.TrustSet = {
      TransactionType: "TrustSet",
      Account: issuerWallet.classicAddress,
      LimitAmount: {
        currency: currency,
        issuer: trustlineAddress, // Points to the OTHER party in the trustline
        value: "0", // Issuer sets 0 limit
      },
      Flags: xrpl.TrustSetFlags.tfSetfAuth, // This flag authorizes the trustline
    };

    const prepared = await client.autofill(trustSetTx);
    const signed = issuerWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    if (!isTypedTransactionSuccessful(result)) {
      const errorInfo = handleTransactionError(result, "authorizeTrustline");
      return {
        success: false,
        errorCode: errorInfo.code,
        message: errorInfo.message,
      };
    }

    const msg = `Trustline successfully authorized for 
${trustlineAddress} 
by issuer
${issuerWallet.classicAddress}
for currency ${currency}`;
    
    return {
      success: true,
      message: msg,
    };
  } catch (error) {
    throw new Error(`Failed to authorize trustline: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export default authorizeTrustline;

