import { connectXRPLClient, client } from "../testnet";
import { 
  AccountOffersRequest, 
  AccountOffersResponse, 
  AccountTxRequest, 
  AccountTxResponse,
} from "xrpl";
import { YONAWallet } from "@/types/appTypes";
import { EnhancedOffer } from "@/types/xrpl/dexXRPLTypes";


/**
 * List all direct offers for a specific wallet with creation timestamps
 * 
 * @param wallet - The wallet to list offers for
 * @returns Array of offers with creation timestamps
 */
export default async function getUserOffers(wallet: YONAWallet): Promise<EnhancedOffer[]> {
  try {
    await connectXRPLClient();

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
      limit: 500,
      forward: false
    };

    const accountTx: AccountTxResponse = await client.request(accountTxRequest);
    const transactions = accountTx.result?.transactions || [];
    
    // Create a map of sequence numbers to timestamps and hashes from OfferCreate transactions
    const offerDetails = new Map<number, { dateTime: string; hash: string }>();
    
    transactions.forEach((tx) => {
      if (tx.tx_json && tx.tx_json.TransactionType === 'OfferCreate') {
        const sequence = tx.tx_json.Sequence;
        const timestamp = tx.tx_json.date + 946684800;
        const dateTime = new Date(timestamp * 1000).toLocaleString();
        const hash = tx.hash;
        
        offerDetails.set(sequence, { dateTime, hash });
      }
    });

    // Enhance offers with timestamps
    const enhancedOffers = directOffers.map((offer) => {
      const details = offerDetails.get((offer as any).seq);
      
      return {
        ...offer,
        dateTime: details?.dateTime,
        creationHash: details?.hash
      };
    });

    // Sort by sequence number (most recent first)
    enhancedOffers.sort((a, b) => (b as any).seq - (a as any).seq);
    
    console.log(`📋 Found ${enhancedOffers.length} active offers for ${wallet.classicAddress}`);
    
    return enhancedOffers;

  } catch (error: any) {
    throw new Error(`Failed to get user offers: ${error.message}`);
  }
}
