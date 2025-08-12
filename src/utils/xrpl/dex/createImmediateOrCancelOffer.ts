import { client, connectXrplClient } from "../testnet";
import { OfferCreate, TxResponse, Amount } from "xrpl";
import * as xrpl from "xrpl";

interface Wallet {
  classicAddress: string;
  sign: (tx: any) => any;
}

interface CreateImmediateOrCancelOfferResult {
  success: boolean;
  sequence?: number;
  response?: TxResponse;
  message: string;
  error?: string;
}

/**
 * Create an Immediate-Or-Cancel offer (with tfImmediateOrCancel flag set).
 * This type of offer is either filled immediately (fully or partially) or cancelled.
 * @param wallet - The wallet creating the offer.
 * @param takerPays - The amount the taker pays (what the offerer receives).
 * @param takerGets - The amount the taker gets (what the offerer pays).
 * @returns The transaction response.
 */
export default async function createImmediateOrCancelOffer(
  wallet: Wallet,
  takerPays: Amount,
  takerGets: Amount,
): Promise<CreateImmediateOrCancelOfferResult> {
  try {
    await connectXrplClient();

    const offerCreateTx: OfferCreate = {
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
    const response: TxResponse = await client.submitAndWait(signedTx.tx_blob);

    // Check transaction result
    if ((response.result.meta as any).TransactionResult === "tesSUCCESS") {
      console.log("✅ ImmediateOrCancel offer processed successfully!");

    // Build comprehensive message
    let message = "\n📊 Immediate-Or-Cancel Offer Results:\n";
    message += `👛 Wallet Address: ${wallet.classicAddress}\n`;
    message += `💱 Requested to Pay: ${
      typeof takerGets === "object"
        ? `${parseFloat(takerGets.value).toFixed(6)} ${takerGets.currency}`
        : `${xrpl.dropsToXrp(takerGets).toFixed(6)} XRP`
    }\n`;
    message += `💱 Requested to Get: ${
      typeof takerPays === "object"
        ? `${parseFloat(takerPays.value).toFixed(6)} ${takerPays.currency}`
        : `${xrpl.dropsToXrp(takerPays).toFixed(6)} XRP`
    }\n`;
    message += `📋 Transaction Hash: ${response.result.hash}\n`;
    message += `📋 Ledger Index: ${response.result.ledger_index}\n`;

    // Analyze immediate execution results
    try {
      const meta = response.result.meta as any;
      const affectedNodes = meta.AffectedNodes || [];
      
      const modifiedOffers = affectedNodes.filter((node: any) => 
        node.ModifiedNode && node.ModifiedNode.LedgerEntryType === "Offer"
      );
      
      const deletedOffers = affectedNodes.filter((node: any) => 
        node.DeletedNode && node.DeletedNode.LedgerEntryType === "Offer"
      );

      const createdOffer = affectedNodes.find((node: any) => 
        node.CreatedNode && node.CreatedNode.LedgerEntryType === "Offer"
      );

      if (modifiedOffers.length > 0 || deletedOffers.length > 0) {
        if (createdOffer) {
          message += `🔄 Offer PARTIALLY FILLED and remainder placed in order book\n`;
          message += `📝 New offer sequence: ${createdOffer.CreatedNode.NewFields?.Sequence}\n`;
        } else {
          message += `✅ Offer COMPLETELY FILLED immediately\n`;
        }
        message += `🎯 Consumed ${modifiedOffers.length + deletedOffers.length} existing offers\n`;
      } else if (createdOffer) {
        message += `📝 Offer placed in order book (no immediate matches)\n`;
        message += `📝 Offer sequence: ${createdOffer.CreatedNode.NewFields?.Sequence}\n`;
      } else {
        message += `❌ Offer was cancelled (no matches and couldn't be placed)\n`;
      }

    } catch (analysisError) {
      message += `❓ Could not analyze execution results\n`;
    }

    return {
      success: true,
      response: response,
      message,
    };
    } else {
      throw new Error(
        `ImmediateOrCancel offer failed: ${(response.result.meta as any).TransactionResult}`,
      );
    }

  } catch (error: any) {
    console.error("❌ Error creating immediate-or-cancel offer:", error.message);
    return {
      success: false,
      error: `Immediate-or-cancel offer failed: ${error.message}`,
      message: "",
    };
  }
}
