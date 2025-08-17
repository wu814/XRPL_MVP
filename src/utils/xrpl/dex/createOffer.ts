import { client, connectXRPLClient } from "../testnet";
import { OfferCreate, TxResponse, Amount } from "xrpl"; // Import XRPL's Amount type
import * as xrpl from "xrpl";

interface Wallet {
  classicAddress: string;
  sign: (tx: any) => any;
}

  

interface CreateOfferResult {
  success: boolean;
  sequence?: number;
  response?: TxResponse;
  message: string; // Match original - always include message
  error?: string;
}

export default async function createOffer(
  wallet: Wallet,
  takerPays: Amount,  // Use XRPL's Amount type
  takerGets: Amount,  // Use XRPL's Amount type
): Promise<CreateOfferResult> {
  try {
    await connectXRPLClient();
    
    const offerCreateTx: OfferCreate = {
      TransactionType: "OfferCreate",
      Account: wallet.classicAddress,
      TakerPays: takerPays,
      TakerGets: takerGets,
    };

    console.log("📜 Prepared OfferCreate TX:", JSON.stringify(offerCreateTx, null, 4));

    const preparedTx = await client.autofill(offerCreateTx);
    console.log("Autofilled OfferCreate TX:", JSON.stringify(preparedTx, null, 4));

    // Set LastLedgerSequence
    const ledgerResponse = await client.request({ command: "ledger_current" });
    const currentLedger = ledgerResponse.result.ledger_current_index;
    preparedTx.LastLedgerSequence = currentLedger + 20;
    console.log(`Set LastLedgerSequence to ${preparedTx.LastLedgerSequence} (current ledger: ${currentLedger})`);

    const signedTx = wallet.sign(preparedTx);
    console.log("🚀 Submitting OfferCreate transaction...");
    console.log("******TakerPays******", takerPays, typeof takerPays);
    console.log("******TakerGets******", takerGets, typeof takerGets);
    const response: TxResponse = await client.submitAndWait(signedTx.tx_blob);

    // Check transaction result
    if ((response.result.meta as any).TransactionResult === "tesSUCCESS") {
      console.log("✅ Offer created successfully!");

    // Try to get transaction details and ledger timestamp (matching original)
    try {
      const ledgerInfo = await client.request({
        command: "ledger",
        ledger_index: response.result.ledger_index,
        transactions: false,
        accounts: false,
      });

      if (ledgerInfo.result?.ledger?.close_time) {
        const ledgerTimestamp = ledgerInfo.result.ledger.close_time;
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

    // Build message exactly like original
    let message = "\n📊 Offer Details:\n";
    message += `👛 Wallet Address: ${wallet.classicAddress}\n`;

    // Fix the string conversion for dropsToXrp
    message += `💱 Paying: ${
      typeof takerGets === "object"
        ? `${parseFloat(takerGets.value).toFixed(6)} ${takerGets.currency}`
        : `${xrpl.dropsToXrp(takerGets).toFixed(6)} XRP`
    }\n`;

    message += `💱 Getting: ${
      typeof takerPays === "object"
        ? `${parseFloat(takerPays.value).toFixed(6)} ${takerPays.currency}`
        : `${xrpl.dropsToXrp(takerPays).toFixed(6)} XRP`
    }\n`;

    message += `📋 Transaction Hash: ${response.result.hash}\n`;
    message += `📋 Ledger Index: ${response.result.ledger_index}\n`;

    // Extract offer sequence from AffectedNodes (like original)
    let offerSequence: number | undefined;
    try {
      const meta = response.result.meta as any;
      const createdNode = meta.AffectedNodes?.find(
        (node: any) => node.CreatedNode && node.CreatedNode.LedgerEntryType === "Offer"
      );

      if (createdNode?.CreatedNode?.NewFields) {
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
      message, // Include all logs as a string (like original)
    };
    } else {
      throw new Error(
        `OfferCreate failed: ${(response.result.meta as any).TransactionResult}`,
      );
    }

  } catch (error: any) {
    console.error("❌ Error creating offer:", error.message);
    return {
      success: false,
      error: `Offer creation failed: ${error.message}`,
      message: "", // Add empty message for consistency
    };
  }
}
