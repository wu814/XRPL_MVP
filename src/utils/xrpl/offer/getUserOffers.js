import { connectXrplClient, client } from "../testnet";

/**
 * List all direct offers for a specific wallet with creation timestamps
 * 
 * @param {object} wallet - The wallet to list offers for
 * @returns {array} Array of offers with creation timestamps
 */
export default async function getUserOffers(wallet) {
  try {
    await connectXrplClient();

    // Fetch direct offers from the account (OfferCreate transactions)
    const accountOffers = await client.request({
      command: "account_offers",
      account: wallet.classicAddress,
      ledger_index: "validated"
    });

    const directOffers = accountOffers.result.offers || [];

    // If no offers, return empty array
    if (directOffers.length === 0) {
      return [];
    }

    // Get transaction history to find OfferCreate transactions with timestamps
    const accountTx = await client.request({
      command: "account_tx",
      account: wallet.classicAddress,
      binary: false,
      limit: 500, // Get more transactions to find offer creation times
      forward: false
    });

    const transactions = accountTx.result?.transactions || [];
    
    // Create a map of sequence numbers to timestamps and hashes from OfferCreate transactions
    const offerDetails = new Map();
    
    // First pass: try to find transaction hashes from account_tx
    transactions.forEach((txData) => {
      try {
        const tx = txData.tx || txData.transaction || txData.tx_json || txData;
        
        if (tx.TransactionType === "OfferCreate" && tx.Sequence) {
          // Convert timestamp from ripple epoch to JavaScript Date
          let timestamp = null;
          if (tx.date) {
            timestamp = new Date((tx.date + 946684800) * 1000);
          } else if (txData.date) {
            timestamp = new Date((txData.date + 946684800) * 1000);
          }
          
          // Try to extract hash from all possible locations
          const hash = tx.hash || txData.hash || tx.Hash || txData.Hash || null;
          
          offerDetails.set(tx.Sequence, {
            timestamp: timestamp,
            hash: hash
          });
        }
      } catch (error) {
        console.warn("Error processing transaction for timestamp:", error.message);
      }
    });

    // Second pass: for offers without hashes, try to get transaction by account and sequence
    const enhancedOffers = [];
    
    for (const offer of directOffers) {
      let details = offerDetails.get(offer.seq);
      
      // If we don't have a hash, try to get it using tx command
      if (!details?.hash) {
        try {
          // Try to get the specific transaction by account and sequence
          const txLookup = await client.request({
            command: "account_tx",
            account: wallet.classicAddress,
            binary: false,
            limit: 10,
            forward: false,
            // Look for transactions with this sequence number
            min_ledger: Math.max(1, offer.seq - 100),
            max_ledger: offer.seq + 100
          });
          
          const targetTx = txLookup.result?.transactions?.find(txData => {
            const tx = txData.tx || txData.transaction || txData.tx_json || txData;
            return tx.TransactionType === "OfferCreate" && tx.Sequence === offer.seq;
          });
          
          if (targetTx) {
            const tx = targetTx.tx || targetTx.transaction || targetTx.tx_json || targetTx;
            const hash = tx.hash || targetTx.hash || tx.Hash || targetTx.Hash || null;
            
            let timestamp = null;
            if (tx.date) {
              timestamp = new Date((tx.date + 946684800) * 1000);
            } else if (targetTx.date) {
              timestamp = new Date((targetTx.date + 946684800) * 1000);
            }
            
            details = { timestamp, hash };
          }
        } catch (lookupError) {
          console.warn(`Failed to lookup transaction for sequence ${offer.seq}:`, lookupError.message);
        }
      }
      
      enhancedOffers.push({
        ...offer,
        createdAt: details?.timestamp || null,
        formattedDate: details?.timestamp ? details.timestamp.toLocaleString() : "Unknown",
        hash: details?.hash || null
      });
    }

    // Sort offers by creation time (newest first) or by sequence if no timestamp
    enhancedOffers.sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return b.createdAt - a.createdAt; // Newest first
      }
      return b.seq - a.seq; // Fallback to sequence number
    });

    return enhancedOffers;
  } catch (error) {
    console.error("❌ Error listing offers for wallet:", error.message);
    throw error;
  }
}