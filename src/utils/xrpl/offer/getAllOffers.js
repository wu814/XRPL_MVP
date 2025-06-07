// utils/xrpl/offer/listAllOffers.js
import { connectXrplClient, client } from "../testnet";

/**
 * List all offers on XRPL matching the given takerGets and takerPays objects.
 * @param {object} takerGets - Asset the taker will receive. Format: { currency, issuer } or { currency: "XRP" }
 * @param {object} takerPays - Asset the taker will pay. Format: { currency, issuer } or { currency: "XRP" }
 * @returns {Promise<object[]>} Array of matching offers.
 */
export default async function getAllOffers(takerGets, takerPays) {
  await connectXrplClient();

  const request = {
    command: "book_offers",
    taker_gets: takerGets,
    taker_pays: takerPays,
    ledger_index: "validated",
    limit: 100, // or increase as needed
  };

  const response = await client.request(request);
  return response.result.offers || [];
}
