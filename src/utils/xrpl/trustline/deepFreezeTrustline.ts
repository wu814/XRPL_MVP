import { client, connectXRPLClient } from "../testnet";
import * as xrpl from "xrpl";
import { isTypedTransactionSuccessful, handleTransactionError } from "../errorHandler";

interface DeepFreezeResult {
  success: boolean;
  message: string;
  errorCode?: string;
}

/**
 * Freeze a trustline to prevent the counterparty from sending tokens.
 * Optionally include deep freeze to block receiving too.
 * 
 * Regular freeze: Blocks sending tokens to others
 * Deep freeze (optional): Also blocks receiving tokens (except from issuer)
 * 
 * Requirements for deep freeze:
 * - The issuer must have already set a regular freeze on the trust line, OR
 * - The tfSetFreeze flag must be set in the same transaction
 * - The issuer cannot have the No Freeze flag enabled on their account
 * 
 * Reference: https://xrpl.org/docs/concepts/tokens/fungible-tokens/deep-freeze
 * 
 * @param issuerWallet - Issuer wallet that will freeze the trustline
 * @param trustlineAddress - Address of the account to freeze
 * @param currency - Currency code for the trustline
 * @param includeDeepFreeze - If true, include deep freeze (blocks receiving too)
 * @returns Success or error result
 */
export async function deepFreezeTrustline(
  issuerWallet: xrpl.Wallet,
  trustlineAddress: string,
  currency: string,
  includeDeepFreeze: boolean = false,
): Promise<DeepFreezeResult> {
  try {
    await connectXRPLClient();

    // Check if the issuer has the No Freeze flag set
    const accountInfo = await client.request({
      command: "account_info",
      account: issuerWallet.classicAddress,
      ledger_index: "validated",
    });

    const issuerFlags = Number(accountInfo.result.account_data.Flags);
    // asfNoFreeze flag is 0x00200000 = 2097152 in decimal
    const hasNoFreeze = (issuerFlags & 0x00200000) !== 0;

    if (hasNoFreeze) {
      return {
        success: false,
        message: `Cannot freeze: Issuer ${issuerWallet.classicAddress} has No Freeze enabled. Individual freezes are not allowed when No Freeze is set.`,
      };
    }

    console.log(`✅ Issuer does not have No Freeze flag. Freeze is allowed.`);

    // Check if trustline exists
    const accountLines = await client.request({
      command: "account_lines",
      account: issuerWallet.classicAddress,
      peer: trustlineAddress,
      ledger_index: "validated",
    });

    const trustline = accountLines.result.lines.find(
      (line) => line.currency === currency
    );

    if (!trustline) {
      return {
        success: false,
        message: `No trustline found between issuer ${issuerWallet.classicAddress} and ${trustlineAddress} for ${currency}`,
      };
    }

    console.log(`✅ Found trustline for ${currency}`);
    
    // Check if trustline is already frozen
    // freeze: true means issuer has frozen the trustline
    // freeze_peer: true means counterparty has frozen the trustline
    const isAlreadyFrozen = trustline.freeze === true;
    
    if (isAlreadyFrozen && !includeDeepFreeze) {
      return {
        success: false,
        message: `Trustline is already frozen. If you want to apply deep freeze, enable the "Include deep freeze" option.`,
      };
    }
    
    console.log(`🔹 Freeze status: ${isAlreadyFrozen ? 'Already frozen' : 'Not frozen'}`);

    // Build the TrustSet transaction with freeze flags
    // According to XRPL docs: https://xrpl.org/docs/tutorials/how-tos/use-tokens/freeze-a-trust-line
    // 
    // CRITICAL FLAG VALUES (from XRPL documentation):
    // - tfSetFreeze = 0x00100000 = 1048576 (decimal)
    // - tfSetDeepFreeze = 0x00400000 = 4194304 (decimal)
    //
    // The issuer sends a TrustSet with:
    // - Account: issuer (themselves)
    // - LimitAmount.currency: the currency code
    // - LimitAmount.issuer: COUNTERPARTY address (identifies which trustline to freeze)
    // - LimitAmount.value: "0" (issuer's limit)
    // - Flags: tfSetFreeze and/or tfSetDeepFreeze
    
    let flags = 0;
    
    // Only set tfSetFreeze if not already frozen
    if (!isAlreadyFrozen) {
      flags |= 0x00100000; // tfSetFreeze = 1048576 (blocks counterparty from sending)
    }

    if (includeDeepFreeze) {
      flags |= 0x00400000; // Add tfSetDeepFreeze = 4194304 (also blocks counterparty from receiving)
    }
    
    // If no flags need to be set, return early
    if (flags === 0) {
      return {
        success: false,
        message: `Trustline is already in the desired state (frozen without deep freeze).`,
      };
    }
    
    if (includeDeepFreeze && isAlreadyFrozen) {
      console.log(`🔹 Trustline already frozen, adding deep freeze only (0x${flags.toString(16)}) for ${trustlineAddress}`);
    } else if (includeDeepFreeze && !isAlreadyFrozen) {
      console.log(`🔹 Setting regular freeze AND deep freeze (0x${flags.toString(16)}) for ${trustlineAddress}`);
    } else {
      console.log(`🔹 Setting regular freeze only (0x${flags.toString(16)}) for ${trustlineAddress}`);
    }

    const trustSetTx: xrpl.TrustSet = {
      TransactionType: "TrustSet",
      Account: issuerWallet.classicAddress,
      LimitAmount: {
        currency: currency,
        issuer: trustlineAddress, // COUNTERPARTY address (identifies which trustline)
        value: "0", // Issuer's limit (always 0)
      },
      Flags: flags,
    };

    const prepared = await client.autofill(trustSetTx);
    const signed = issuerWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    if (!isTypedTransactionSuccessful(result)) {
      const errorInfo = handleTransactionError(result, "deepFreezeTrustline");
      return {
        success: false,
        errorCode: errorInfo.code,
        message: errorInfo.message,
      };
    }

    const msg = includeDeepFreeze 
      ? `Freeze and deep freeze successfully applied to trustline:
${trustlineAddress}
by issuer ${issuerWallet.classicAddress}
for currency ${currency}

Effects:
• Counterparty CANNOT send tokens to others (frozen)
• Counterparty CANNOT receive tokens from anyone except issuer (deep frozen)
• Counterparty's offers to buy/sell this token are unfunded
• Counterparty can only transact directly with the issuer`
      : `Freeze successfully applied to trustline:
${trustlineAddress}
by issuer ${issuerWallet.classicAddress}
for currency ${currency}

Effects:
• Counterparty CANNOT send tokens to others
• Counterparty CAN still receive tokens
• Counterparty CAN send tokens back to the issuer`;
    
    return {
      success: true,
      message: msg,
    };
  } catch (error) {
    throw new Error(`Failed to deep freeze trustline: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Clear deep freeze from a trustline, allowing normal operations to resume.
 * Note: This also clears the regular freeze automatically.
 * 
 * Reference: https://xrpl.org/docs/concepts/tokens/fungible-tokens/deep-freeze
 * 
 * @param issuerWallet - Issuer wallet that will clear the deep freeze
 * @param trustlineAddress - Address of the account to unfreeze
 * @param currency - Currency code for the trustline
 * @returns Success or error result
 */
export async function clearDeepFreeze(
  issuerWallet: xrpl.Wallet,
  trustlineAddress: string,
  currency: string,
): Promise<DeepFreezeResult> {
  try {
    await connectXRPLClient();

    // Check if trustline exists
    const accountLines = await client.request({
      command: "account_lines",
      account: issuerWallet.classicAddress,
      peer: trustlineAddress,
      ledger_index: "validated",
    });

    const trustline = accountLines.result.lines.find(
      (line) => line.currency === currency
    );

    if (!trustline) {
      return {
        success: false,
        message: `No trustline found between issuer ${issuerWallet.classicAddress} and ${trustlineAddress} for ${currency}`,
      };
    }

    console.log(`🔹 Clearing deep freeze and regular freeze for ${trustlineAddress}`);

    // Build the TrustSet transaction to clear both freezes
    // From xrpl.js TrustSetFlags:
    // tfClearFreeze = 0x00200000 = 2097152
    // tfClearDeepFreeze = 0x00800000 = 8388608
    const flags = 0x00200000 | 0x00800000; // Clear both regular freeze and deep freeze

    const trustSetTx: xrpl.TrustSet = {
      TransactionType: "TrustSet",
      Account: issuerWallet.classicAddress,
      LimitAmount: {
        currency: currency,
        issuer: trustlineAddress,
        value: "0",
      },
      Flags: flags,
    };

    const prepared = await client.autofill(trustSetTx);
    const signed = issuerWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    if (!isTypedTransactionSuccessful(result)) {
      const errorInfo = handleTransactionError(result, "clearDeepFreeze");
      return {
        success: false,
        errorCode: errorInfo.code,
        message: errorInfo.message,
      };
    }

    const msg = `Deep freeze and regular freeze cleared for trustline:
${trustlineAddress}
by issuer ${issuerWallet.classicAddress}
for currency ${currency}

The counterparty can now:
• Send and receive tokens normally
• Create and execute offers with this token`;
    
    return {
      success: true,
      message: msg,
    };
  } catch (error) {
    throw new Error(`Failed to clear deep freeze: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export default deepFreezeTrustline;

