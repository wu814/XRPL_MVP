import { connectXrplClient, client } from "../testnet";
import { 
  AccountOffersRequest, 
  AccountOffersResponse, 
  AccountTxRequest, 
  AccountTxResponse,
  AccountOffer // Use AccountOffer instead of OfferObject
} from "xrpl";

interface Wallet {
  classicAddress: string;
}

interface OfferWithTimestamp extends AccountOffer {
  timestamp?: number;
  date?: string;
  creation_hash?: string;
}

/**
 * List all direct offers for a specific wallet with creation timestamps
 * 
 * @param wallet - The wallet to list offers for
 * @returns Array of offers with creation timestamps
 */
export default async function getUserOffers(wallet: Wallet): Promise<OfferWithTimestamp[]> {
  try {
    await connectXrplClient();

    // Fetch direct offers from the account (OfferCreate transactions)
    const accountOffersRequest: AccountOffersRequest = {
      command: "account_offers",
      account: wallet.classicAddress,
      ledger_index: "validated"
    };

    const accountOffers: AccountOffersResponse = await client.request(accountOffersRequest);
    const directOffers = accountOffers.result.offers || [];

    // If no offers, return empty array
    if (directOffers.length === 0) {
      return [];
    }

    // Get transaction history to find OfferCreate transactions with timestamps
    const accountTxRequest: AccountTxRequest = {
      command: "account_tx",
      account: wallet.classicAddress,
      binary: false,
      limit: 500, // Get more transactions to find offer creation times
      forward: false
    };

    const accountTx: AccountTxResponse = await client.request(accountTxRequest);
    const transactions = accountTx.result?.transactions || [];
    
    // Create a map of sequence numbers to timestamps and hashes from OfferCreate transactions
    const offerDetails = new Map<number, { timestamp: number; date: string; hash: string }>();
    
    transactions.forEach((tx) => {
      if (tx.tx && (tx.tx as any).TransactionType === 'OfferCreate') {
        const sequence = (tx.tx as any).Sequence;
        const timestamp = (tx.tx as any).date + 946684800; // Convert Ripple timestamp to Unix timestamp
        const date = new Date(timestamp * 1000).toISOString();
        const hash = (tx.tx as any).hash;
        
        offerDetails.set(sequence, { timestamp, date, hash });
      }
    });

    // Enhance offers with timestamps
    const enhancedOffers: OfferWithTimestamp[] = directOffers.map((offer) => {
      const details = offerDetails.get((offer as any).seq); // Use seq, not Sequence
      
      return {
        ...offer, // Spread all OfferObject properties
        timestamp: details?.timestamp,
        date: details?.date,
        creation_hash: details?.hash
      };
    });

    // Sort by sequence number (most recent first)
    enhancedOffers.sort((a, b) => (b as any).seq - (a as any).seq);
    
    console.log(`📋 Found ${enhancedOffers.length} active offers for ${wallet.classicAddress}`);
    
    return enhancedOffers;

  } catch (error: any) {
    console.error("Error fetching user offers:", error);
    throw new Error(`Failed to fetch user offers: ${error.message}`);
  }
}
