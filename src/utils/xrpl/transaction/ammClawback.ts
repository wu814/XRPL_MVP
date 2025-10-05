import { client, connectXRPLClient } from "../testnet";
import * as xrpl from "xrpl";
import { ClawbackResult } from "@/types/xrpl/transactionXRPLTypes";
import { handleTransactionError, isTypedTransactionSuccessful } from "../errorHandler";

/**
 * Executes an AMM clawback operation to reclaim tokens from a holder who has deposited
 * your issued tokens into an AMM pool.
 *
 * XRPL Docs: https://xrpl.org/docs/references/protocol/transactions/types/ammclawback
 *
 * Requirements:
 * - The issuer must have the AllowTrustLineClawback flag enabled
 * - The issuer must be the issuer of Asset (the asset being clawed back)
 * - The holder must have LP tokens from the specified AMM pool
 *
 * @param issuerWallet - The issuer wallet with clawback flags enabled
 * @param holder - The account holding LP tokens to be clawed back
 * @param asset - The asset being clawed back (must be issued by issuer)
 * @param asset2 - The other asset in the AMM pool
 * @param amount - Optional: Maximum amount to claw back. If not specified, claws back all holder's tokens
 * @param clawTwoAssets - If true, claws back both assets proportionally (both must be issued by issuer)
 * @returns Promise<ClawbackResult> - Transaction response
 */
export default async function ammClawback(
  issuerWallet: xrpl.Wallet,
  holder: string,
  asset: {
    currency: string;
    issuer: string;
  },
  asset2: {
    currency: string;
    issuer: string;
  },
  amount?: string,
  clawTwoAssets: boolean = false,
): Promise<ClawbackResult> {
  try {
    await connectXRPLClient();

    console.log(
      `🔹 Preparing AMM clawback from ${holder} for ${asset.currency}...`,
    );

    // Verify the issuer wallet has the clawback flag enabled
    const accountInfo = await client.request({
      command: "account_info",
      account: issuerWallet.classicAddress,
      ledger_index: "validated",
    });

    // lsfAllowTrustLineClawback is 0x00080000
    const flags = Number(accountInfo.result.account_data.Flags);
    const hasClawbackFlag = (flags & 0x00080000) !== 0;

    if (!hasClawbackFlag) {
      return {
        success: false,
        message: `Issuer ${issuerWallet.classicAddress} does not have AllowTrustLineClawback flag enabled. Enable this flag before attempting AMM clawback.`,
      };
    }

    console.log("✅ AllowTrustLineClawback flag is enabled on the account.");

    // Verify the asset issuer matches the Account field
    if (asset.issuer !== issuerWallet.classicAddress) {
      return {
        success: false,
        message: `Asset issuer (${asset.issuer}) must match the clawback account (${issuerWallet.classicAddress})`,
      };
    }

    // If clawTwoAssets is enabled, verify both assets are issued by the issuer
    if (clawTwoAssets && asset2.issuer !== issuerWallet.classicAddress) {
      return {
        success: false,
        message: `When clawing back two assets, both must be issued by ${issuerWallet.classicAddress}. Asset2 issuer is ${asset2.issuer}`,
      };
    }

    // Verify AMM pool exists
    console.log(`🔍 Checking if AMM pool exists for ${asset.currency}/${asset2.currency}...`);
    
    try {
      const ammInfo = await client.request({
        command: "amm_info",
        asset: {
          currency: asset.currency,
          issuer: asset.issuer,
        },
        asset2: {
          currency: asset2.currency,
          issuer: asset2.issuer,
        },
        ledger_index: "validated",
      });

      console.log(`✅ Found AMM pool: ${ammInfo.result.amm.account}`);
    } catch (error) {
      return {
        success: false,
        message: `No AMM pool found for ${asset.currency}/${asset2.currency}. The AMM must exist before clawback.`,
      };
    }

    // Build the AMMClawback transaction
    const ammClawbackTx: xrpl.AMMClawback = {
      TransactionType: "AMMClawback",
      Account: issuerWallet.classicAddress,
      Holder: holder,
      Asset: {
        currency: asset.currency,
        issuer: asset.issuer,
      },
      Asset2: {
        currency: asset2.currency,
        issuer: asset2.issuer,
      },
    };

    // Add optional amount if specified
    if (amount) {
      ammClawbackTx.Amount = {
        currency: asset.currency,
        issuer: asset.issuer,
        value: amount,
      };
    }

    // Add tfClawTwoAssets flag if specified
    if (clawTwoAssets) {
      ammClawbackTx.Flags = 0x00000001; // tfClawTwoAssets = 1
    }

    console.log("📜 Preparing AMMClawback transaction...");

    const preparedTx = await client.autofill(ammClawbackTx);
    const signedTx = issuerWallet.sign(preparedTx);
    
    console.log("🚀 Submitting AMMClawback transaction...");
    const response = await client.submitAndWait(signedTx.tx_blob);

    if (!isTypedTransactionSuccessful(response)) {
      const errorInfo = handleTransactionError(response, "ammClawback");
      return {
        success: false,
        message: errorInfo.message,
        errorCode: errorInfo.code,
      };
    }

    const clawbackMsg = amount 
      ? `Successfully clawed back ${amount} ${asset.currency} from AMM pool (holder: ${holder})`
      : `Successfully clawed back all ${asset.currency} from AMM pool (holder: ${holder})`;

    console.log(`✅ ${clawbackMsg}`);
    
    return {
      success: true,
      message: clawbackMsg,
    };
  } catch (error) {
    console.error("❌ Error in AMM clawback operation:", error instanceof Error ? error.message : String(error));
    return {
      success: false,
      message: `Error in AMM clawback operation: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
