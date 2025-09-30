import { client, connectXRPLClient } from "../testnet";
import { OfferCreate, TxResponse, Amount, Wallet, dropsToXrp } from "xrpl"; // Import XRPL's Amount type
import { CreateOfferResult } from "@/types/xrpl/dexXRPLTypes";
import { handleTransactionError, isTypedTransactionSuccessful } from "../errorHandler";


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
    const response: TxResponse<OfferCreate> = await client.submitAndWait<OfferCreate>(signedTx.tx_blob);

    // Check transaction result
    if (isTypedTransactionSuccessful(response)) {
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
        : `${dropsToXrp(takerGets).toFixed(6)} XRP`
    }\n`;

    message += `💱 Getting: ${
      typeof takerPays === "object"
        ? `${parseFloat(takerPays.value).toFixed(6)} ${takerPays.currency}`
        : `${dropsToXrp(takerPays).toFixed(6)} XRP`
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
      message: message,
    };
    } else {
      const errorInfo = handleTransactionError(response, "createOffer");
      return {
        success: false,
        message: errorInfo.message,
        errorCode: errorInfo.code,
      };
    }

  } catch (error: any) {
    console.error("❌ Error creating offer:", error.message);
    return {
      success: false,
      message: `Offer creation failed: ${error.message}`,
      errorCode: "UNKNOWN_ERROR",
    };
  }
}
