import { client, connectXRPLClient } from "../testnet";
import * as xrpl from "xrpl";
import { Clawback } from "xrpl";

// Type definitions
interface AccountInfoResponse {
  result: {
    account_data: {
      Flags: number;
      [key: string]: any;
    };
  };
}

interface AccountLinesResponse {
  result: {
    lines: Array<{
      currency: string;
      balance: string;
      [key: string]: any;
    }>;
  };
}

interface Trustline {
  currency: string;
  balance: string;
  [key: string]: any;
}

interface LedgerResponse {
  result: {
    ledger_current_index: number;
  };
}

interface ClawbackResponse {
  result: {
    meta: {
      TransactionResult: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
}

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
  issuerWallet: xrpl.Wallet,
  account: string,
  currency: string,
  amount: string | number,
): Promise<ClawbackResponse> {
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

    // Debug log the full account data to check flags
    console.log(
      "📊 Issuer account info:",
      JSON.stringify(accountInfo.result.account_data, null, 2),
    );

    // lsfAllowTrustLineClawback is 0x00010000 (hexadecimal) = 65536 (decimal)
    const flags = Number(accountInfo.result.account_data.Flags);
    console.log(`🔍 Account flags (decimal): ${flags}`);
    console.log(`🔍 Account flags (hex): 0x${flags.toString(16)}`);

    // Convert to binary to check bits individually
    const flagsBinary = flags.toString(2).padStart(32, "0");
    console.log(`🔍 Account flags (binary): ${flagsBinary}`);

    // The bit for lsfAllowTrustLineClawback is at position 16 (0-indexed from right)
    // In binary, bit positions are counted from right to left, starting from 0
    const relevantBit = flagsBinary.charAt(flagsBinary.length - 17);
    console.log(
      `🔍 lsfAllowTrustLineClawback bit (position 16): ${relevantBit}`,
    );

    // Alternate check method using bitwise operations
    const hasClawbackFlag = (flags & 0x00010000) !== 0;
    console.log(`🔍 Has clawback flag (bitwise check): ${hasClawbackFlag}`);

    if (!hasClawbackFlag) {
      // If the flag check fails, let's proceed anyway with a warning
      console.log(
        "⚠️ Warning: AllowTrustLineClawback flag check failed, but proceeding with clawback attempt anyway.",
      );
      console.log(
        "⚠️ If the transaction fails, please ensure you've set flag 16 (asfAllowTrustLineClawback) on your account.",
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

    console.log(
      `📊 Trustline info:`,
      JSON.stringify(accountLines.result, null, 2),
    );

    // Find the specific trustline for the currency
    const trustline: Trustline | undefined = accountLines.result.lines.find(
      (line) => line.currency === currency,
    );

    if (!trustline) {
      throw new Error(
        `No trustline found for ${currency} between ${account} and ${issuerWallet.classicAddress}`,
      );
    }

    console.log(`✅ Found trustline with balance: ${trustline.balance}`);

    if (parseFloat(trustline.balance) <= 0) {
      throw new Error(
        `Account has no ${currency} balance to claw back (current balance: ${trustline.balance})`,
      );
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
    console.log(JSON.stringify(clawbackTx, null, 2));

    const preparedTx = await client.autofill(clawbackTx);

    // Set LastLedgerSequence to ensure transaction doesn't hang
    const ledgerResponse: LedgerResponse = await client.request({ command: "ledger_current" });
    const currentLedger = ledgerResponse.result.ledger_current_index;
    (preparedTx as any).LastLedgerSequence = currentLedger + 10;

    console.log(
      "📜 Prepared transaction:",
      JSON.stringify(preparedTx, null, 2),
    );

    const signedTx = issuerWallet.sign(preparedTx);
    console.log("🚀 Submitting Clawback transaction...");
    const response = await client.submitAndWait(signedTx.tx_blob);

    // Debug log the full response for troubleshooting
    console.log("📊 Full response:", JSON.stringify(response, null, 2));

    if ((response.result.meta as any).TransactionResult === "tesSUCCESS") {
      console.log(
        `✅ Successfully clawed back ${amount} ${currency} from ${account}`,
      );
      return response as any;
    } else {
      throw new Error(
        `Clawback failed: ${(response.result.meta as any).TransactionResult}`,
      );
    }
  } catch (error) {
    console.error("❌ Error in clawback operation:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}
