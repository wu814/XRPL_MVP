import { NextRequest, NextResponse } from "next/server";
import { getAllSellOffers, getAllBuyOffers } from "@/utils/xrpl/dex/getAllOffers";
import { APIResponse, GetAllOffersAPIRequest } from "@/types/apiTypes";
import { BookOffer } from "xrpl";
import { formatBookOfferCurrency, formatXRPLCurrency } from "@/utils/currencyUtils";

export async function POST(req: NextRequest): Promise<NextResponse<APIResponse<{ sellOffers: BookOffer[], buyOffers: BookOffer[] }>>> {
  try {
    const {
      baseCurrency,
      baseIssuerAddress,
      quoteCurrency,
      quoteIssuerAddress,
    }: GetAllOffersAPIRequest = await req.json();

    if (!baseCurrency || !quoteCurrency) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Missing required currencies." },
        { status: 400 },
      );
    }
    
    const takerGets = formatBookOfferCurrency(baseCurrency, baseIssuerAddress);
    const takerPays = formatBookOfferCurrency(quoteCurrency, quoteIssuerAddress);

    const sellOffers = await getAllSellOffers(takerGets, takerPays);
    const buyOffers = await getAllBuyOffers(takerGets, takerPays);

    return NextResponse.json<APIResponse<{ sellOffers: BookOffer[], buyOffers: BookOffer[] }>>(
      { success: true, message: "Offers fetched successfully", data: { sellOffers, buyOffers } },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error listing offers:", err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return NextResponse.json<APIResponse<never>>({ success: false, message: errorMessage }, { status: 500 });
  }
}
