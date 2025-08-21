import { connectXRPLClient, client } from "../testnet";
import { 
  AccountTxRequest, 
  AccountTxResponse, 
  AccountOffersRequest, 
  AccountOffersResponse,
  Amount,
} from "xrpl";
import { EnhancedCompletedOffer } from "@/types/xrpl/dexXRPLTypes";
import { YONAWallet } from "@/types/appTypes";

interface OfferCreateInfo {
  sequence: number;
  takerPays: Amount;
  takerGets: Amount;
  createdAt: Date | null;
  hash: string | null;
}

interface OfferCancelInfo {
  cancelledAt: Date | null;
  hash: string | null;
}

// Helper function to check if a transaction resulted in actual asset exchanges
const hasAssetExchange = (txData: any, walletAddress: string): boolean => {
  const meta = txData.meta;
  if (!meta || !meta.AffectedNodes) return false;

  // Check for balance changes in affected nodes
  const affectedNodes = meta.AffectedNodes;
  let hasBalanceChange = false;

  for (const node of affectedNodes) {
    const nodeData = node.ModifiedNode || node.DeletedNode || node.CreatedNode;
    if (!nodeData) continue;

    // Look for RippleState (trustline) or AccountRoot changes that indicate balance changes
    if (nodeData.LedgerEntryType === "RippleState" || nodeData.LedgerEntryType === "AccountRoot") {
      const finalFields = nodeData.FinalFields || {};
      const previousFields = nodeData.PreviousFields || {};
      
      // Check if balance changed
      if (previousFields.Balance !== undefined && finalFields.Balance !== previousFields.Balance) {
        hasBalanceChange = true;
        break;
      }
    }
  }

  // Also check for DeliveredAmount which indicates successful payment/exchange
  const deliveredAmount = meta.DeliveredAmount;
  if (deliveredAmount && deliveredAmount !== "0") {
    hasBalanceChange = true;
  }

  return hasBalanceChange;
};

/**
 * Get completed offers (filled or cancelled) for a specific wallet
 * 
 * @param wallet - The wallet to get completed offers for
 * @returns Array of completed offers with status and completion info
 */
export default async function getCompletedOffers(wallet: YONAWallet): Promise<EnhancedCompletedOffer[]> {
  try {
    await connectXRPLClient();

    // Get transaction history to find OfferCreate and related transactions
    const accountTxRequest: AccountTxRequest = {
      command: "account_tx",
      account: wallet.classicAddress,
      binary: false,
      limit: 500, // Get more transactions to find offer history
      forward: false
    };

    const accountTx: AccountTxResponse = await client.request(accountTxRequest);
    const transactions = accountTx.result?.transactions || [];
    
    // Get current active offers to exclude them from completed offers
    const accountOffersRequest: AccountOffersRequest = {
      command: "account_offers",
      account: wallet.classicAddress,
      ledger_index: "validated"
    };

    const accountOffers: AccountOffersResponse = await client.request(accountOffersRequest);
    const activeOfferSequences = new Set(
      (accountOffers.result.offers || []).map(offer => (offer as any).seq)
    );

    // Find all OfferCreate transactions and explicit cancellations
    const offerCreates = new Map<number, OfferCreateInfo>();
    const offerCancels = new Map<number, OfferCancelInfo>();
    const completedOffers: EnhancedCompletedOffer[] = [];

    // Process all transactions to find offer creates and cancels
    transactions.forEach((txData, index) => {
      try {
        const tx = (txData as any).tx || (txData as any).transaction || (txData as any).tx_json || txData;
        
        if (!tx.Sequence) return;

        // Convert timestamp from ripple epoch to JavaScript Date
        let timestamp: Date | null = null;
        if (tx.date) {
          timestamp = new Date((tx.date + 946684800) * 1000);
        } else if ((txData as any).date) {
          timestamp = new Date(((txData as any).date + 946684800) * 1000);
        }

        // Extract hash using the same logic as active offers
        const hash: string | null = tx.hash || (txData as any).hash || tx.Hash || (txData as any).Hash || null;

        if (tx.TransactionType === "OfferCreate" && tx.Account === wallet.classicAddress) {
          // Check if the offer was immediately filled/killed by looking at metadata
          const meta = (txData as any).meta;
          let wasImmediatelyFilled = false;
          let wasKilled = false;

          if (meta) {
            if (meta.TransactionResult === "tesSUCCESS") {
              // Check if offer was immediately filled by examining affected nodes
              const affectedNodes = meta.AffectedNodes || [];
              const hasRemainingOffer = affectedNodes.some((node: any) => 
                node.CreatedNode && 
                node.CreatedNode.LedgerEntryType === "Offer" &&
                node.CreatedNode.NewFields &&
                node.CreatedNode.NewFields.Account === wallet.classicAddress
              );
              
              // If no offer node was created, it was immediately filled
              if (!hasRemainingOffer) {
                wasImmediatelyFilled = true;
              }
            } else if (meta.TransactionResult === "tecKILLED") {
              wasKilled = true;
            }
          }

          if (wasImmediatelyFilled || wasKilled) {
            // For killed offers, check if assets were actually exchanged
            let finalStatus: "filled" | "cancelled" = "cancelled";
            if (wasImmediatelyFilled) {
              finalStatus = "filled";
            } else if (wasKilled) {
              // Check if the transaction resulted in actual asset exchanges
              const hadAssetExchange = hasAssetExchange(txData, wallet.classicAddress);
              finalStatus = hadAssetExchange ? "filled" : "cancelled";
            }

            // Add to completed offers immediately
            completedOffers.push({
              sequence: tx.Sequence,
              takerPays: tx.TakerPays,
              takerGets: tx.TakerGets,
              createdAtDateTime: timestamp ? timestamp.toLocaleString() : "Unknown",
              completedAtDateTime: timestamp ? timestamp.toLocaleString() : "Unknown",
              status: finalStatus,
              createHash: hash,
              completeHash: hash
            });
          } else {
            // Store for later processing
            offerCreates.set(tx.Sequence, {
              sequence: tx.Sequence,
              takerPays: tx.TakerPays,
              takerGets: tx.TakerGets,
              createdAt: timestamp,
              hash: hash
            });
          }
        } else if (tx.TransactionType === "OfferCancel") {
          offerCancels.set(tx.OfferSequence, {
            cancelledAt: timestamp,
            hash: hash
          });
        }
      } catch (error: any) {
        console.warn("Error processing transaction:", error.message);
      }
    });

    // Process remaining offers to determine completion status
    offerCreates.forEach((offer, sequence) => {
      // Skip if this offer is still active
      if (activeOfferSequences.has(sequence)) {
        return;
      }

      let status: "filled" | "cancelled" = "filled";
      let completedAt: Date | null = null;
      let completedHash: string | null = null;

      // Check if it was explicitly cancelled
      if (offerCancels.has(sequence)) {
        const cancelInfo = offerCancels.get(sequence)!;
        status = "cancelled";
        completedAt = cancelInfo.cancelledAt;
        completedHash = cancelInfo.hash;
      } else {
        // If not cancelled and not active, it was filled
        status = "filled";
        
        // Try to find a reasonable completion time by looking at transactions after the offer
        const laterTransactions = transactions.filter(txData => {
          const tx = (txData as any).tx || (txData as any).transaction || (txData as any).tx_json || txData;
          return tx.Sequence > sequence && tx.date;
        });

        if (laterTransactions.length > 0) {
          // Use the earliest transaction after the offer as an approximation
          const earliestLater = laterTransactions[laterTransactions.length - 1]; // Array is in reverse order
          const tx = (earliestLater as any).tx || (earliestLater as any).transaction || (earliestLater as any).tx_json || earliestLater;
          completedAt = new Date((tx.date + 946684800) * 1000);
          // For filled offers, we don't have the exact completion transaction hash
          // So we'll use the creation hash as a fallback
          completedHash = offer.hash;
        } else {
          // If no later transactions, use creation time + 1 hour as estimate
          completedAt = offer.createdAt ? new Date(offer.createdAt.getTime() + 60 * 60 * 1000) : null;
          completedHash = offer.hash;
        }
      }

      completedOffers.push({
        sequence,
        takerPays: offer.takerPays,
        takerGets: offer.takerGets,
        createdAtDateTime: offer.createdAt ? offer.createdAt.toLocaleString() : "Unknown",
        completedAtDateTime: completedAt ? completedAt.toLocaleString() : "Unknown",
        status,
        createHash: offer.hash,
        completeHash: completedHash
      });
    });

    // Sort by completion time (newest first)
    completedOffers.sort((a, b) => {
      if (a.createdAtDateTime && b.createdAtDateTime) {
        return new Date(b.createdAtDateTime).getTime() - new Date(a.createdAtDateTime).getTime();
      }
      return b.sequence - a.sequence;
    });

    console.log(`📋 Found ${completedOffers.length} completed offers for ${wallet.classicAddress}`);

    return completedOffers;
  } catch (error: any) {
    console.error("❌ Error getting completed offers:", error.message);
    throw new Error(`Failed to get completed offers: ${error.message}`);
  }
}
