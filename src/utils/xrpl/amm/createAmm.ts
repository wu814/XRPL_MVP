import { client, connectXRPLClient } from "../testnet";
import { AMMCreate, Wallet, TxResponse, Amount, TransactionMetadataBase } from "xrpl";
import { formatAmountForXRPL } from "@/utils/assetUtils";
import { isTypedTransactionSuccessful, handleTransactionError } from "../errorHandler";
import { YONAWallet } from "@/types/appTypes";
import { CreateAMMResult } from "@/types/xrpl/ammXRPLTypes";


/**
 * Creates an AMM on the XRPL
 * @param treasuryXRPLWallet - Treasury Wallet object with .seed
 * @param issuerWallets - Array of issuer wallet(s)
 * @param currency1 - Currency 1 (e.g., XRP or token code)
 * @param value1 - Amount for currency 1
 * @param currency2 - Currency 2 (e.g., USD, XRP)
 * @param value2 - Amount for currency 2
 * @param tradingFee - Trading fee in basis points
 * @returns AMM metadata
 */
export default async function createAMM(
  treasuryXRPLWallet: Wallet,
  issuerWallets: YONAWallet[],
  currency1: string,
  value1: number,
  currency2: string,
  value2: number,
  tradingFee: number,
): Promise<CreateAMMResult> {
  await connectXRPLClient();
  console.log("✅ Preparing AMM creation...");

  const issuerWallet = issuerWallets?.[0];
  if (!issuerWallet) throw new Error("Missing issuer wallet.");

  if (isNaN(value1) || value1 <= 0) {
    throw new Error("Invalid or missing amount for Asset A.");
  }
  if (isNaN(value2) || value2 <= 0) {
    throw new Error("Invalid or missing amount for Asset B.");
  }

  // Sort currencies alphabetically to ensure consistent ordering
  const currencies = [currency1, currency2].sort();
  
  // Swap amounts if currency order changed
  let amount1Value = value1;
  let amount2Value = value2;
  
  if (currencies[0] !== currency1) {
    // Currency order changed, swap the amounts
    amount1Value = value2;
    amount2Value = value1;
  }

  // Prepare assets for transaction
  const amount1: Amount = formatAmountForXRPL({currency: currencies[0], issuer: issuerWallet.classicAddress, value: amount1Value.toString()});
  const amount2: Amount = formatAmountForXRPL({currency: currencies[1], issuer: issuerWallet.classicAddress, value: amount2Value.toString()});

  // change the fee (in drops) to create AMM
  const tx: AMMCreate = {
    TransactionType: "AMMCreate",
    Account: treasuryXRPLWallet.classicAddress,
    TradingFee: tradingFee,
    Amount: amount1,
    Amount2: amount2,
    Fee: "2000000",
    Flags: 0,
  };

  console.log("📜 AMM Create transaction:", JSON.stringify(tx, null, 2));

  const preparedTx = await client.autofill(tx);
  preparedTx.LastLedgerSequence = (preparedTx.LastLedgerSequence || 0) + 50;

  // Submit the transaction
  const signedTx = treasuryXRPLWallet.sign(preparedTx);
  const submission: TxResponse<AMMCreate> = await client.submitAndWait<AMMCreate>(signedTx.tx_blob);

  // Check if the transaction was successful using the new error handling
  if (!isTypedTransactionSuccessful(submission)) {
    const errorInfo = handleTransactionError(submission, "Creating AMM");
    return {
      success: false,
      error: {
        code: errorInfo.code,
        message: `AMM creation failed: ${errorInfo.message}`
      },
      account: "",
      currency1: currencies[0],
      currency2: currencies[1],
    };
  }

  console.log("✅ AMM created successfully!");

  // Search for the AMM account by looking at the transaction metadata
  const txHash = submission.result.hash;
  const txResponse: TxResponse = await client.request({
    command: "tx",
    transaction: txHash,
    ledger_index: "validated"
  });
  
  // Extract AMM account from the transaction metadata
  const meta = txResponse.result.meta as TransactionMetadataBase;
  let ammAccount: string | unknown;
  
  if (meta?.AffectedNodes) {
    for (const node of meta.AffectedNodes) {
      if ("CreatedNode" in node && node.CreatedNode?.LedgerEntryType === "AMM") {
        ammAccount = node.CreatedNode.NewFields?.Account;
        break;
      }
    }
  }
  
  if (!ammAccount) {
    return {
      success: false,
      error: {
        code: "AMM_ACCOUNT_NOT_FOUND",
        message: "Could not find AMM account after creation."
      },
      account: "",
      currency1: currencies[0],
      currency2: currencies[1],
    };
  }

  // Return the actual AMM account ID
  return {
    success: true,
    account: ammAccount as string,
    currency1: currencies[0],
    currency2: currencies[1],
  };
}
