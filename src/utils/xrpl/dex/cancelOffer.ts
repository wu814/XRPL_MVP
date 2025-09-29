import { connectXRPLClient, client } from "../testnet";
import { OfferCancel, TxResponse, Wallet } from "xrpl";
import { isTypedTransactionSuccessful, handleTransactionError } from "../errorHandler";
import { CancelOfferResult } from "@/types/xrpl/dexXRPLTypes";

export default async function cancelOffer(
  wallet: Wallet, 
  offerSequence: string | number
): Promise<CancelOfferResult> {
  try {
    await connectXRPLClient();

    // Validate and convert offerSequence to number
    const sequenceNumber = parseInt(offerSequence.toString());
    if (isNaN(sequenceNumber) || sequenceNumber <= 0) {
      throw new Error(
        `Invalid offer sequence: ${offerSequence}. Must be a positive number.`,
      );
    }

    const offerCancelTx: OfferCancel = {
      TransactionType: "OfferCancel",
      Account: wallet.classicAddress,
      OfferSequence: sequenceNumber,
    };
    console.log(
      "📜 Prepared OfferCancel TX:",
      JSON.stringify(offerCancelTx, null, 4),
    );

    const preparedTx = await client.autofill(offerCancelTx);
    console.log(
      "Autofilled OfferCancel TX:",
      JSON.stringify(preparedTx, null, 4),
    );

    // Set LastLedgerSequence to current ledger + 20 (matching other offer types).
    const ledgerResponse = await client.request({ command: "ledger_current" });
    const currentLedger = ledgerResponse.result.ledger_current_index;
    preparedTx.LastLedgerSequence = currentLedger + 20;
    console.log(
      `Set LastLedgerSequence to ${preparedTx.LastLedgerSequence} (current ledger: ${currentLedger})`,
    );

    const signedTx = wallet.sign(preparedTx);
    console.log("🚀 Submitting OfferCancel transaction...");
    const response: TxResponse<OfferCancel> = await client.submitAndWait<OfferCancel>(signedTx.tx_blob);

    // Check transaction result
    if (!isTypedTransactionSuccessful(response)) {
      const errorInfo = handleTransactionError(response, "cancelOffer");
      return {
        success: false,
        message: errorInfo.message,
        errorCode: errorInfo.code,
      };
    }

    console.log("✅ Offer cancelled successfully!");

    let message = "\n📊 Offer Cancellation Details:\n";
    message += `👛 Wallet Address: ${wallet.classicAddress}\n`;
    message += `🔹 Cancelled Offer Sequence: ${sequenceNumber}\n`;
    message += `📋 Transaction Hash: ${response.result.hash}\n`;
    message += `📋 Ledger Index: ${response.result.ledger_index}`;

    return {
      success: true,
      message: message,
    };

  } catch (error: any) {
    console.error("❌ Error cancelling offer:", error.message);
    return {
      success: false,
      message: `Offer cancellation failed: ${error.message}`,
    };
  }
}
