import { client, connectXRPLClient } from "../testnet";
import { Clawback, Wallet, AccountInfoResponse, AccountLinesResponse, AccountLinesTrustline, TxResponse } from "xrpl";
import { ClawbackResult } from "@/types/xrpl/transactionXRPLTypes";
import { handleTransactionError, isTypedTransactionSuccessful } from "../errorHandler";


/**
 * Executes a clawback operation to reclaim tokens from a specified account
 *
 * XRPL Docs: https://xrpl.org/clawback.html
 *
 * @param issuerWallet - The issuer wallet with clawback flags enabled
 * @param account - The account address to clawback tokens from
 * @param currency - The currency code of the tokens to clawback
 * @param amount - The amount of tokens to clawback
 * @returns Promise<ClawbackResponse> - Transaction response
 */
export default async function clawbackTokens(
  issuerWallet: Wallet,
  account: string,
  currency: string,
  amount: string,
): Promise<ClawbackResult> {
  try {
    await connectXRPLClient();

    console.log(
      `🔹 Preparing to clawback ${amount} ${currency} from ${account}...`,
    );

    // Verify the issuer wallet has the clawback flag enabled
    const accountInfo: AccountInfoResponse = await client.request({
      command: "account_info",
      account: issuerWallet.classicAddress,
      ledger_index: "validated",
    });

    // lsfAllowTrustLineClawback is 0x00010000 (hexadecimal) = 65536 (decimal)
    const flags = Number(accountInfo.result.account_data.Flags);

    // Alternate check method using bitwise operations
    const hasClawbackFlag = (flags & 0x00080000) !== 0;
    console.log(`🔍 Has clawback flag (bitwise check): ${hasClawbackFlag}`);

    if (!hasClawbackFlag) {
      // If the flag check fails, let's proceed anyway with a warning
      console.log(
        "⚠️ Warning: AllowTrustLineClawback flag check failed, but proceeding with clawback attempt anyway.",
      );
      console.log(
        "⚠️ If the transaction fails, please ensure you've set flag lsfAllowTrustLineClawback on your account.",
      );
    } else {
      console.log("✅ AllowTrustLineClawback flag is enabled on the account.");
    }

    // Verify the target account actually has a trustline with the issuer for this currency
    console.log(
      `🔍 Checking if ${account} has a trustline with ${issuerWallet.classicAddress} for ${currency}...`,
    );
    const accountLines: AccountLinesResponse = await client.request({
      command: "account_lines",
      account: account,
      peer: issuerWallet.classicAddress,
      ledger_index: "validated",
    });

    // Find the specific trustline for the currency
    const trustline: AccountLinesTrustline = accountLines.result.lines.find(
      (line) => line.currency === currency,
    );

    if (!trustline) {
      return {
        success: false,
        message: `No trustline found for ${currency} between ${account} and ${issuerWallet.classicAddress}`,
      };
    }

    console.log(`✅ Found trustline with balance: ${trustline.balance}`);

    if (parseFloat(trustline.balance) <= 0) {
      return {
        success: false,
        message: `Account has no ${currency} balance to claw back (current balance: ${trustline.balance})`,
      };
    }

    // Create the Clawback transaction - structure according to documentation:
    // For an IOU (trust line) in the XRP Ledger, the issuer's address is in the Account field,
    // and the token holder's address is in the Amount field's issuer sub-field
    const clawbackTx: Clawback = {
      TransactionType: "Clawback",
      Account: issuerWallet.classicAddress,
      Amount: {
        currency: currency,
        issuer: account, // The holder's account ID (the account we're clawing back from)
        value: amount.toString(), // Ensure amount is a string
      },
    };

    console.log("📜 Preparing Clawback transaction...");

    const preparedTx = await client.autofill(clawbackTx);
    const signedTx = issuerWallet.sign(preparedTx);
    console.log("🚀 Submitting Clawback transaction...");
    const response: TxResponse<Clawback> = await client.submitAndWait<Clawback>(signedTx.tx_blob);

    if (!isTypedTransactionSuccessful(response)) {
      const errorInfo = handleTransactionError(response, "clawbackTokens");
      return {
        success: false,
        message: errorInfo.message,
        errorCode: errorInfo.code,
      };
    }

    console.log(
      `✅ Successfully clawed back ${amount} ${currency} from ${account}`,
    );
    return {
      success: true,
      message: `Successfully clawed back ${amount} ${currency} from ${account}`,
    };
  } catch (error) {
    console.error("❌ Error in clawback operation:", error instanceof Error ? error.message : String(error));
    return {
      success: false,
      message: `Error in clawback operation: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
