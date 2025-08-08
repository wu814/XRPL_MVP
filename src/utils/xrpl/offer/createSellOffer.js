import { connect } from "http2";
import { client, connectXrplClient } from "../testnet";
import * as xrpl from "xrpl";

/**
 * Create a Sell offer (with tfSell flag set).
 * This type of offer fully consumes the TakerGets amount before consuming TakerPays.
 * @param {Wallet} wallet - The wallet creating the offer.
 * @param {object} takerPays - The amount the taker pays (what the offerer receives).
 * @param {object} takerGets - The amount the taker gets (what the offerer pays).
 * @returns {object} The transaction response.
 */
export default async function createSellOffer(
  wallet,
  takerPays,
  takerGets,
) {
  try {
    await connectXrplClient();

    const offerCreateTx = {
      TransactionType: "OfferCreate",
      Account: wallet.classicAddress,
      TakerPays: takerPays,
      TakerGets: takerGets,
      Flags: xrpl.OfferCreateFlags.tfSell,
    };

    console.log(
      "📜 Prepared Sell OfferCreate TX:",
      JSON.stringify(offerCreateTx, null, 4),
    );

    const preparedTx = await client.autofill(offerCreateTx);

    // Set LastLedgerSequence to ensure transaction doesn't hang
    const ledgerResponse = await client.request({ command: "ledger_current" });
    const currentLedger = ledgerResponse.result.ledger_current_index;
    preparedTx.LastLedgerSequence = currentLedger + 20;

    const signedTx = wallet.sign(preparedTx);
    console.log("🚀 Submitting Sell OfferCreate transaction...");
    const response = await client.submitAndWait(signedTx.tx_blob);

    if (response.result.meta.TransactionResult === "tesSUCCESS") {
      console.log("✅ Sell offer created successfully!");

      // Try to get transaction details and ledger timestamp with error handling
      try {
        // Get ledger information using the ledger index from the transaction response
        const ledgerResponse = await client.request({
          command: "ledger",
          ledger_index: response.result.ledger_index,
          transactions: false,
          accounts: false,
        });

        // Get the timestamp from the ledger
        if (
          ledgerResponse.result &&
          ledgerResponse.result.ledger &&
          ledgerResponse.result.ledger.close_time
        ) {
          const ledgerTimestamp = ledgerResponse.result.ledger.close_time;
          const date = new Date((ledgerTimestamp + 946684800) * 1000); // Convert ripple epoch to JS timestamp

          // Validate the date before formatting
          if (!isNaN(date.getTime())) {
            const formattedDate = date.toISOString();
            console.log(`🕒 Transaction Time: ${formattedDate}`);
          } else {
            console.log("🕒 Transaction Time: Unable to format timestamp");
          }
        } else {
          console.log("🕒 Transaction Time: Not available");
        }
      } catch (timestampError) {
        console.log("🕒 Transaction Time: Error retrieving timestamp");
      }

      let message = "\n📊 Sell Offer Details:\n";
      message += `👛 Wallet Address: ${wallet.classicAddress}\n`;

      // From creator's perspective
      message += `💱 Selling: ${
        typeof takerGets === "object"
          ? `${parseFloat(takerGets.value).toFixed(6)} ${takerGets.currency}`
          : `${parseFloat(xrpl.dropsToXrp(takerGets)).toFixed(6)} XRP`
      }\n`;

      message += `💱 Getting: ${
        typeof takerPays === "object"
          ? `${parseFloat(takerPays.value).toFixed(6)} ${takerPays.currency}`
          : `${parseFloat(xrpl.dropsToXrp(takerPays)).toFixed(6)} XRP`
      }\n`;

      message += `📋 Transaction Hash: ${response.result.hash}\n`;
      message += `📋 Ledger Index: ${response.result.ledger_index}\n`;

      let offerSequence;
      try {
        const createdNode = response.result.meta.AffectedNodes.find(
          (node) =>
            node.CreatedNode && node.CreatedNode.LedgerEntryType === "Offer",
        );

        if (createdNode && createdNode.CreatedNode.NewFields) {
          offerSequence = createdNode.CreatedNode.NewFields.Sequence;
          message += `📋 Offer Sequence: ${offerSequence}\n`;
        }
      } catch (error) {
        message += `❓ Could not determine offer sequence\n`;
      }

      return {
        success: true,
        sequence: offerSequence,
        response: response,
        message,
      };
    } else {
      throw new Error(
        `Sell OfferCreate failed: ${response.result.meta.TransactionResult}`,
      );
    }
  } catch (error) {
    console.error("❌ Error creating Sell offer:", error.message);
    throw new Error(`Failed to create Sell offer: ${error.message}`);
  }
}
