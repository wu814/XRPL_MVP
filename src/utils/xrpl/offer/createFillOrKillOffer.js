import { connect } from "http2";
import { client, connectXrplClient } from "../testnet";
import * as xrpl from "xrpl";
/**
 * Create a Fill-Or-Kill offer (with tfFillOrKill flag set).
 * This type of offer is either filled completely or cancelled completely.
 * @param {Wallet} wallet - The wallet creating the offer.
 * @param {object} takerPays - The amount the taker pays (what the offerer receives).
 * @param {object} takerGets - The amount the taker gets (what the offerer pays).
 * @param {number} destinationTag - Optional destination tag for operational wallets.
 * @returns {object} The transaction response.
 */
export default async function createFillOrKillOffer(
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
      Flags: xrpl.OfferCreateFlags.tfFillOrKill,
    };

    // Add destination tag if provided
    if (destinationTag !== null && destinationTag !== "") {
      offerCreateTx.DestinationTag = destinationTag;
    }

    console.log(
      "📜 Prepared FillOrKill OfferCreate TX:",
      JSON.stringify(offerCreateTx, null, 4),
    );

    const preparedTx = await client.autofill(offerCreateTx);

    // Set LastLedgerSequence to ensure transaction doesn't hang
    const ledgerResponse = await client.request({ command: "ledger_current" });
    const currentLedger = ledgerResponse.result.ledger_current_index;
    preparedTx.LastLedgerSequence = currentLedger + 20;

    const signedTx = wallet.sign(preparedTx);
    console.log("🚀 Submitting FillOrKill OfferCreate transaction...");
    const response = await client.submitAndWait(signedTx.tx_blob);

    if (response.result.meta.TransactionResult === "tesSUCCESS") {
      console.log("✅ FillOrKill offer filled successfully!");

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

      console.log("\n📊 FillOrKill Offer Details: ");
      console.log(`👛 Wallet Address: ${wallet.classicAddress}`);
      console.log(
        `💰 Wallet Type: ${wallet.classicAddress.startsWith("r") ? "Standard" : "Unknown"}`,
      );

      if (destinationTag !== null && destinationTag !== "") {
        console.log(`🏷️ Destination Tag: ${destinationTag}`);
      }

      // Log offer details - FIXED to show from creator's perspective
      // TakerPays = what creator receives, TakerGets = what creator pays
      console.log(
        `💱 Paying: ${typeof takerGets === "object" ? `${takerGets.value} ${takerGets.currency}` : `${xrpl.dropsToXrp(takerGets)} XRP`}`,
      );
      console.log(
        `💱 Getting: ${typeof takerPays === "object" ? `${takerPays.value} ${takerPays.currency}` : `${xrpl.dropsToXrp(takerPays)} XRP`}`,
      );
      console.log(`📋 Transaction Hash: ${response.result.hash}`);
      console.log(`📋 Ledger Index: ${response.result.ledger_index}`);

      // Try to extract offer sequence number
      let offerSequence;
      try {
        // Look through affected nodes to find the created offer
        const createdNode = response.result.meta.AffectedNodes.find(
          (node) =>
            node.CreatedNode && node.CreatedNode.LedgerEntryType === "Offer",
        );

        if (createdNode && createdNode.CreatedNode.NewFields) {
          offerSequence = createdNode.CreatedNode.NewFields.Sequence;
          console.log(`📋 Offer Sequence: ${offerSequence}`);
        }
      } catch (error) {
        console.log(`❓ Could not determine offer sequence`);
      }

      // Let createOffer handle the detailed logging
      return {
        success: true,
        sequence: offerSequence,
        response: response,
      };
    } else if (response.result.meta.TransactionResult === "tecKILLED") {
      console.log(
        "🔄 FillOrKill offer was killed (could not be completely filled)",
      );

      // Get transaction details and ledger timestamp with safe handling
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

      console.log("\n📊 Killed Offer Details: ");
      console.log(`👛 Wallet Address: ${wallet.classicAddress}`);
      console.log(
        `💱 Attempted to pay: ${typeof takerGets === "object" ? `${takerGets.value} ${takerGets.currency}` : `${xrpl.dropsToXrp(takerGets)} XRP`}`,
      );
      console.log(
        `💱 Attempted to get: ${typeof takerPays === "object" ? `${takerPays.value} ${takerPays.currency}` : `${xrpl.dropsToXrp(takerPays)} XRP`}`,
      );
      console.log(`📋 Transaction Hash: ${response.result.hash}`);
      console.log(`📋 Ledger Index: ${response.result.ledger_index}`);
      console.log(
        `📋 Transaction Result: ${response.result.meta.TransactionResult}`,
      );
      console.log(
        `ℹ️ Reason: Fill-or-Kill offers must be completely filled or they get cancelled`,
      );

      if (destinationTag !== null && destinationTag !== "") {
        console.log(`🏷️ Destination Tag: ${destinationTag}`);
      }

      return {
        success: true,
        response: response,
        killed: true,
        hash: response.result.hash,
        ledger_index: response.result.ledger_index,
      };
    } else {
      throw new Error(
        `FillOrKill OfferCreate failed: ${response.result.meta.TransactionResult}`,
      );
    }
  } catch (error) {
    console.error("❌ Error creating FillOrKill offer:", error.message);
    throw new Error(`FillOrKill OfferCreate failed: ${error.message}`);
  }
}
