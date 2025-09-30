import { client, connectXRPLClient } from "../testnet";
import { OfferCreate, TxResponse, Amount, OfferCreateFlags, dropsToXrp, Wallet } from "xrpl";
import { CreateOfferResult } from "@/types/xrpl/dexXRPLTypes";
import { handleTransactionError, isTypedTransactionSuccessful } from "../errorHandler";
/**
 * Create a passive offer (with tfPassive flag set).
 * This type of offer doesn't consume offers that exactly match it.
 * @param wallet - The wallet creating the offer.
 * @param takerPays - The amount the taker pays (what the offerer receives).
 * @param takerGets - The amount the taker gets (what the offerer pays).
 * @returns The transaction response.
 */
export default async function createPassiveOffer(
  wallet: Wallet,
  takerPays: Amount,
  takerGets: Amount,
): Promise<CreateOfferResult> {
  try {
    await connectXRPLClient();

    const offerCreateTx: OfferCreate = {
      TransactionType: "OfferCreate",
      Account: wallet.classicAddress,
      TakerPays: takerPays,
      TakerGets: takerGets,
      Flags: OfferCreateFlags.tfPassive,
    };

    console.log(
      "📜 Prepared Passive OfferCreate TX:",
      JSON.stringify(offerCreateTx, null, 4),
    );

    const preparedTx = await client.autofill(offerCreateTx);

    // Set LastLedgerSequence to ensure transaction doesn't hang
    const ledgerResponse = await client.request({ command: "ledger_current" });
    const currentLedger = ledgerResponse.result.ledger_current_index;
    preparedTx.LastLedgerSequence = currentLedger + 20;

    const signedTx = wallet.sign(preparedTx);
    console.log("🚀 Submitting Passive OfferCreate transaction...");
    const response: TxResponse<OfferCreate> = await client.submitAndWait<OfferCreate>(signedTx.tx_blob);

    // Check transaction result
    if (isTypedTransactionSuccessful(response)) {
      console.log("✅ Passive offer created successfully!");

    // Try to get transaction details and ledger timestamp
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
          console.log(`🕒 Transaction Time: ${date.toISOString()}`);
        }
      }
    } catch (timestampError) {
      console.log("🕒 Transaction Time: Error retrieving timestamp");
    }

    // Build message
    let message = "\n📊 Passive Offer Details:\n";
    message += `👛 Wallet Address: ${wallet.classicAddress}\n`;
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
    message += `📋 Ledger Index: ${response.result.ledger_index}`;

    // Extract offer sequence from AffectedNodes
    let offerSequence: number | undefined;
    try {
      const meta = response.result.meta as any;
      const createdNode = meta.AffectedNodes?.find(
        (node: any) => node.CreatedNode && node.CreatedNode.LedgerEntryType === "Offer"
      );

      if (createdNode?.CreatedNode?.NewFields) {
        offerSequence = createdNode.CreatedNode.NewFields.Sequence;
        message += `\n📋 Offer Sequence: ${offerSequence}`;
      }
    } catch (error) {
      message += `\n❓ Could not determine offer sequence`;
    }

    return {
      success: true,
      message: message,
    };
    } else {
      const errorInfo = handleTransactionError(response, "createPassiveOffer");
      return {
        success: false,
        message: errorInfo.message,
        errorCode: errorInfo.code,
      };
    }

  } catch (error: any) {
    console.error("❌ Error creating passive offer:", error.message);
    return {
      success: false,
      message: `Passive offer creation failed: ${error.message}`,
      errorCode: "UNKNOWN_ERROR",
    };
  }
}
