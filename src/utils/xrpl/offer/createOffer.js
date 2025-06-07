import { client, connectXrplClient } from "../testnet";
import * as xrpl from "xrpl";

/**
 * Create an OfferCreate transaction.
 * @param {Wallet} wallet - The wallet creating the offer (standby or user).
 * @param {string|object} takerPays - The amount the offer creator is willing to pay.
 *    For XRP, use a string representing drops. For issued currencies, use an object:
 *    { currency: "USD", issuer: "rEXAMPLE...", value: "100" }.
 * @param {string|object} takerGets - The amount the offer creator expects to receive.
 *    Same format as takerPays.
 * @param {number} destinationTag - Optional destination tag for operational wallets.
 * @returns {object} The transaction response.
 */
export default async function createOffer(
  wallet,
  takerPays,
  takerGets,
  destinationTag = null,
) {
  try {
    await connectXrplClient();
    const offerCreateTx = {
      TransactionType: "OfferCreate",
      Account: wallet.classicAddress,
      TakerPays: takerPays,
      TakerGets: takerGets,
    };

    // Add destination tag if provided
    if (destinationTag !== null && destinationTag !== "") {
      offerCreateTx.DestinationTag = destinationTag;
    }

    console.log(
      "📜 Prepared OfferCreate TX:",
      JSON.stringify(offerCreateTx, null, 4),
    );

    const preparedTx = await client.autofill(offerCreateTx);
    console.log(
      "Autofilled OfferCreate TX:",
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
    console.log("🚀 Submitting OfferCreate transaction...");
    const response = await client.submitAndWait(signedTx.tx_blob);

    if (response.result.meta.TransactionResult === "tesSUCCESS") {
      console.log("✅ Offer created successfully!");

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

      let message = "\n📊 Offer Details:\n";
      message += `👛 Wallet Address: ${wallet.classicAddress}\n`;

      if (destinationTag !== null && destinationTag !== "") {
        message += `🏷️ Destination Tag: ${destinationTag}\n`;
      }

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
        message, // Include all logs as a string
      };
    } else {
      throw new Error(
        `OfferCreate failed: ${response.result.meta.TransactionResult}`,
      );
    }
  } catch (error) {
    console.error("❌ Error creating offer:", error.message);
    throw new Error(`Offer creation failed: ${error.message}`);
  }
}
