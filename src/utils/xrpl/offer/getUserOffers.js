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
      limit: 200, // Get more transactions to find offer creation times
      forward: false
    });

    const transactions = accountTx.result?.transactions || [];
    
    // Create a map of sequence numbers to timestamps from OfferCreate transactions
    const offerTimestamps = new Map();
    
    transactions.forEach(txData => {
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
          
          if (timestamp) {
            offerTimestamps.set(tx.Sequence, timestamp);
          }
        }
      } catch (error) {
        console.warn("Error processing transaction for timestamp:", error.message);
      }
    });

    // Enhance offers with timestamps
    const enhancedOffers = directOffers.map(offer => {
      const createdAt = offerTimestamps.get(offer.seq);
      
      return {
        ...offer,
        createdAt: createdAt || null,
        formattedDate: createdAt ? createdAt.toLocaleString() : "Unknown"
      };
    });

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
};