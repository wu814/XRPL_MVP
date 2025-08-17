import { connectXRPLClient, client } from "../testnet";
import { 
  BookOffersRequest, 
  BookOffersResponse, 
  BookOfferCurrency, 
  BookOffer
} from "xrpl";

/**
 * List all offers on XRPL matching the given takerGets and takerPays currencies.
 * @param takerGets - Currency the taker will receive. Format: { currency, issuer } or "XRP"
 * @param takerPays - Currency the taker will pay. Format: { currency, issuer } or "XRP"
 * @returns Array of matching offers.
 */
export async function getAllSellOffers(
  takerGets: BookOfferCurrency, 
  takerPays: BookOfferCurrency
): Promise<BookOffer[]> {
  await connectXRPLClient();

  const request: BookOffersRequest = {
    command: "book_offers",
    taker_gets: takerGets,
    taker_pays: takerPays,
    ledger_index: "validated",
    limit: 100, // or increase as needed
  };

  const response: BookOffersResponse = await client.request(request);
  return response.result.offers || [];
}

/**
 * List all buy offers by reversing the takerGets and takerPays for buy offers
 * @param takerGets - Currency the taker will receive
 * @param takerPays - Currency the taker will pay
 * @returns Array of matching buy offers
 */
export async function getAllBuyOffers(
  takerGets: BookOfferCurrency, 
  takerPays: BookOfferCurrency
): Promise<BookOffer[]> {
  await connectXRPLClient();

  const request: BookOffersRequest = {
    command: "book_offers",
    taker_gets: takerPays, // Reversed for buy offers
    taker_pays: takerGets, // Reversed for buy offers
    ledger_index: "validated",
    limit: 100, // or increase as needed
  };

  const response: BookOffersResponse = await client.request(request);
  return response.result.offers || [];
}