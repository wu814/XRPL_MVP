import { connect } from "http2";
import { client, connectXrplClient } from "../testnet";
import * as xrpl from "xrpl";

/**
 * Create an Immediate-Or-Cancel offer (with tfImmediateOrCancel flag set).
 * This type of offer is either filled immediately (fully or partially) or cancelled.
 * @param {Wallet} wallet - The wallet creating the offer.
 * @param {object} takerPays - The amount the taker pays (what the offerer receives).
 * @param {object} takerGets - The amount the taker gets (what the offerer pays).
 * @returns {object} The transaction response.
 */
export default async function createImmediateOrCancelOffer(
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
      Flags: xrpl.OfferCreateFlags.tfImmediateOrCancel,
    };

    console.log(
      "📜 Prepared ImmediateOrCancel OfferCreate TX:",
      JSON.stringify(offerCreateTx, null, 4),
    );

    const preparedTx = await client.autofill(offerCreateTx);

    // Set LastLedgerSequence to ensure transaction doesn't hang
    const ledgerResponse = await client.request({ command: "ledger_current" });
    const currentLedger = ledgerResponse.result.ledger_current_index;
    preparedTx.LastLedgerSequence = currentLedger + 20;

    const signedTx = wallet.sign(preparedTx);
    console.log("🚀 Submitting ImmediateOrCancel OfferCreate transaction...");
    const response = await client.submitAndWait(signedTx.tx_blob);

    if (response.result.meta.TransactionResult === "tesSUCCESS") {
      console.log("✅ ImmediateOrCancel offer processed successfully!");

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

      // Let createOffer handle the detailed logging
      // Check if offer was filled or cancelled
      let wasFilled = false;
      let amountFilled = "0";

      try {
        // Parse the metadata to see what happened
        if (response.result.meta.AffectedNodes) {
          // Find affected nodes where an offer was partially filled
          const modifiedOfferNodes = response.result.meta.AffectedNodes.filter(
            (node) =>
              node.ModifiedNode &&
              node.ModifiedNode.LedgerEntryType === "Offer",
          );

          if (modifiedOfferNodes.length > 0) {
            wasFilled = true;
            console.log("🔄 Offer was partially filled");
          }

          // Check if there are payment nodes indicating the offer was filled
          const paymentNodes = response.result.meta.AffectedNodes.filter(
            (node) =>
              node.ModifiedNode &&
              node.ModifiedNode.LedgerEntryType === "AccountRoot",
          );

          if (paymentNodes.length > 0) {
            wasFilled = true;
            console.log("✅ Offer was filled");
          }
        }
      } catch (error) {
        console.log("❓ Could not determine if offer was filled or cancelled");
      }

      if (!wasFilled) {
        console.log("🔄 Offer was cancelled after no immediate match");
      }

      let message = "\n📊 ImmediateOrCancel Offer Details:\n";
      message += `👛 Wallet Address: ${wallet.classicAddress}\n`;
      message += `💰 Wallet Type: ${wallet.classicAddress.startsWith("r") ? "Standard" : "Unknown"}\n`;

      // From creator's perspective
      message += `💱 Paying: ${
        typeof takerGets === "object"
          ? `${takerGets.value} ${takerGets.currency}`
          : `${xrpl.dropsToXrp(takerGets)} XRP`
      }\n`;

      message += `💱 Getting: ${
        typeof takerPays === "object"
          ? `${takerPays.value} ${takerPays.currency}`
          : `${xrpl.dropsToXrp(takerPays)} XRP`
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
    } else if (response.result.meta.TransactionResult === "tecKILLED") {
      console.log(
        "🔄 ImmediateOrCancel offer was killed (could not fill any amount)",
      );

      // Get transaction details and ledger timestamp with safe handling
      try {
        const ledgerResponse = await client.request({
          command: "ledger",
          ledger_index: response.result.ledger_index,
          transactions: false,
          accounts: false,
        });

        if (
          ledgerResponse.result &&
          ledgerResponse.result.ledger &&
          ledgerResponse.result.ledger.close_time
        ) {
          const ledgerTimestamp = ledgerResponse.result.ledger.close_time;
          const date = new Date((ledgerTimestamp + 946684800) * 1000);

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

      let message = "\n📊 Killed IOC Offer Details:\n";
      message += `👛 Wallet Address: ${wallet.classicAddress}\n`;

      message += `💱 Attempted to pay: ${
        typeof takerGets === "object"
          ? `${takerGets.value} ${takerGets.currency}`
          : `${xrpl.dropsToXrp(takerGets)} XRP`
      }\n`;

      message += `💱 Attempted to get: ${
        typeof takerPays === "object"
          ? `${takerPays.value} ${takerPays.currency}`
          : `${xrpl.dropsToXrp(takerPays)} XRP`
      }\n`;

      message += `📋 Transaction Hash: ${response.result.hash}\n`;
      message += `📋 Ledger Index: ${response.result.ledger_index}\n`;
      message += `📋 Transaction Result: ${response.result.meta.TransactionResult}\n`;
      message += `ℹ️ Reason: IOC offers are killed if they cannot fill immediately (likely due to authorization issues)\n`;

      return {
        success: false,
        response: response,
        killed: true,
        hash: response.result.hash,
        ledger_index: response.result.ledger_index,
        message,
      };
    } else {
      throw new Error(
        `ImmediateOrCancel OfferCreate failed: ${response.result.meta.TransactionResult}`,
      );
    }
  } catch (error) {
    console.error("❌ Error creating ImmediateOrCancel offer:", error.message);
    throw new Error(
      `Failed to create ImmediateOrCancel offer: ${error.message}`,
    );
  }
}
