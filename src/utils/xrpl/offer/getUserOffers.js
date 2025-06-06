import { connectXrplClient, client } from "../testnet";

/**
 * List all direct offers for a specific wallet (OfferCreate transactions)
 * 
 * @param {object} wallet - The wallet to list offers for
 * @returns {array} Array of offers
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

    console.log(`📋 Found ${directOffers.length} direct offers for ${wallet.classicAddress}`);

    return directOffers;
  } catch (error) {
    console.error("❌ Error listing offers for wallet:", error.message);
    throw error;
  }
};