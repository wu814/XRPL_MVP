import { connectXrplClient, client } from "../testnet";
import * as xrpl from "xrpl";

export default async function cancelOffer(wallet, offerSequence) {
  try {
    await connectXrplClient();

    // Validate and convert offerSequence to number
    const sequenceNumber = parseInt(offerSequence);
    if (isNaN(sequenceNumber) || sequenceNumber <= 0) {
      throw new Error(
        `Invalid offer sequence: ${offerSequence}. Must be a positive number.`,
      );
    }

    const offerCancelTx = {
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
    const response = await client.submitAndWait(signedTx.tx_blob);

    if (response.result.meta.TransactionResult === "tesSUCCESS") {
      if (response.result.meta.TransactionResult === "tesSUCCESS") {
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
      }
    } else {
      throw new Error(
        `OfferCancel failed: ${response.result.meta.TransactionResult}`,
      );
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}
