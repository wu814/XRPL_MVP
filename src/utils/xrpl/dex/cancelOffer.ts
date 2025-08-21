import { connectXRPLClient, client } from "../testnet";
import { OfferCancel, TxResponse } from "xrpl";

interface Wallet {
  classicAddress: string;
  sign: (tx: any) => any;
}

interface CancelOfferResult {
  success: boolean;
  sequence?: number;
  response?: TxResponse;
  message?: string;
  error?: string;
}

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
    const response: TxResponse = await client.submitAndWait(signedTx.tx_blob);

    // Check transaction result
    if ((response.result.meta as any).TransactionResult === "tesSUCCESS") {
      console.log("✅ Offer cancelled successfully!");

    let message = "\n📊 Offer Cancellation Details:\n";
    message += `👛 Wallet Address: ${wallet.classicAddress}\n`;
    message += `🔹 Cancelled Offer Sequence: ${sequenceNumber}\n`;
    message += `📋 Transaction Hash: ${response.result.hash}\n`;
    message += `📋 Ledger Index: ${response.result.ledger_index}`;

    return {
      success: true,
      sequence: sequenceNumber,
      response: response,
      message: message,
    };
    } else {
      throw new Error(
        `Offer cancellation failed: ${(response.result.meta as any).TransactionResult}`,
      );
    }

  } catch (error: any) {
    console.error("❌ Error cancelling offer:", error.message);
    return {
      success: false,
      error: `Offer cancellation failed: ${error.message}`,
    };
  }
}
