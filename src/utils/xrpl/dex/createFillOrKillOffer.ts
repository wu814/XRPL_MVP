import { client, connectXRPLClient } from "../testnet";
import { OfferCreate, TxResponse, Amount } from "xrpl";
import * as xrpl from "xrpl";

interface Wallet {
  classicAddress: string;
  sign: (tx: any) => any;
}

interface CreateFillOrKillOfferResult {
  success: boolean;
  sequence?: number;
  response?: TxResponse;
  message: string;
  error?: string;
}

/**
 * Create a Fill-Or-Kill offer (with tfFillOrKill flag set).
 * This type of offer is either filled completely or cancelled completely.
 * @param wallet - The wallet creating the offer.
 * @param takerPays - The amount the taker pays (what the offerer receives).
 * @param takerGets - The amount the taker gets (what the offerer pays).
 * @returns The transaction response.
 */
export default async function createFillOrKillOffer(
  wallet: Wallet,
  takerPays: Amount,
  takerGets: Amount,
): Promise<CreateFillOrKillOfferResult> {
  try {
    await connectXRPLClient();

    const offerCreateTx: OfferCreate = {
      TransactionType: "OfferCreate",
      Account: wallet.classicAddress,
      TakerPays: takerPays,
      TakerGets: takerGets,
      Flags: xrpl.OfferCreateFlags.tfFillOrKill,
    };

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
    const response: TxResponse = await client.submitAndWait(signedTx.tx_blob);

    // Check transaction result
    if ((response.result.meta as any).TransactionResult === "tesSUCCESS") {
      console.log("✅ FillOrKill offer processed successfully!");

    // Build message with comprehensive details
    let message = "\n📊 Fill-Or-Kill Offer Results:\n";
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

    // Analyze the transaction results to determine if offer was filled or killed
    try {
      const meta = response.result.meta as any;
      const affectedNodes = meta.AffectedNodes || [];
      
      let wasCompletelyFilled = false;
      let actualAmountPaid = "0";
      let actualAmountReceived = "0";
      
      // Check if any offers were consumed (indicating partial/full fill)
      const modifiedOffers = affectedNodes.filter((node: any) => 
        node.ModifiedNode && node.ModifiedNode.LedgerEntryType === "Offer"
      );
      
      const deletedOffers = affectedNodes.filter((node: any) => 
        node.DeletedNode && node.DeletedNode.LedgerEntryType === "Offer"
      );

      if (modifiedOffers.length > 0 || deletedOffers.length > 0) {
        message += `✅ Fill-Or-Kill offer was FILLED (consumed ${modifiedOffers.length + deletedOffers.length} existing offers)\n`;
        
        // Try to calculate actual amounts from balance changes
        const accountRootChanges = affectedNodes.filter((node: any) => 
          node.ModifiedNode && 
          node.ModifiedNode.LedgerEntryType === "AccountRoot" && 
          node.ModifiedNode.FinalFields?.Account === wallet.classicAddress
        );

        if (accountRootChanges.length > 0) {
          const change = accountRootChanges[0].ModifiedNode;
          if (change.PreviousFields?.Balance && change.FinalFields?.Balance) {
            const prevBalance = parseFloat(change.PreviousFields.Balance);
            const finalBalance = parseFloat(change.FinalFields.Balance);
            const balanceChange = finalBalance - prevBalance;
            
            if (balanceChange !== 0) {
              actualAmountReceived = Math.abs(balanceChange).toString();
              message += `💰 Actual XRP received: ${xrpl.dropsToXrp(actualAmountReceived)} XRP\n`;
            }
          }
        }
      } else {
        message += `❌ Fill-Or-Kill offer was KILLED (no matching offers found)\n`;
        message += `ℹ️  The offer could not be filled completely and was cancelled\n`;
      }

    } catch (analysisError) {
      message += `❓ Could not analyze fill/kill results\n`;
    }

    return {
      success: true,
      response: response,
      message,
    };
    } else if ((response.result.meta as any).TransactionResult === "tecKILLED") {
      console.log("🔄 FillOrKill offer was killed (could not be completely filled)");
      
      let message = "\n📊 Killed Offer Details:\n";
      message += `👛 Wallet Address: ${wallet.classicAddress}\n`;
      message += `💱 Attempted to pay: ${
        typeof takerGets === "object"
          ? `${parseFloat(takerGets.value).toFixed(6)} ${takerGets.currency}`
          : `${xrpl.dropsToXrp(takerGets as string).toFixed(6)} XRP`
      }\n`;
      message += `💱 Attempted to get: ${
        typeof takerPays === "object"
          ? `${parseFloat(takerPays.value).toFixed(6)} ${takerPays.currency}`
          : `${xrpl.dropsToXrp(takerPays as string).toFixed(6)} XRP`
      }\n`;
      message += `📋 Transaction Hash: ${response.result.hash}\n`;
      message += `📋 Ledger Index: ${response.result.ledger_index}\n`;
      message += `📋 Transaction Result: ${(response.result.meta as any).TransactionResult}\n`;
      message += `ℹ️ Reason: Fill-or-Kill offers must be completely filled or they get cancelled\n`;

      return {
        success: true,
        response: response,
        message,
      };
    } else {
      throw new Error(
        `FillOrKill offer failed: ${(response.result.meta as any).TransactionResult}`,
      );
    }

  } catch (error: any) {
    console.error("❌ Error creating fill-or-kill offer:", error.message);
    return {
      success: false,
      error: `Fill-or-kill offer failed: ${error.message}`,
      message: "",
    };
  }
}
