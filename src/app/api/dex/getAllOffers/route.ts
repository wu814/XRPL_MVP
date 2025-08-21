import { NextRequest, NextResponse } from "next/server";
import { getAllSellOffers, getAllBuyOffers } from "@/utils/xrpl/dex/getAllOffers";

interface GetAllOffersRequest {
  baseCurrency: string;
  baseIssuerAddress?: string;
  quoteCurrency: string;
  quoteIssuerAddress?: string;
}

interface Asset {
  currency: string;
  issuer?: string;
}

export async function POST(req: NextRequest) {
  try {
    const {
      baseCurrency,
      baseIssuerAddress,
      quoteCurrency,
      quoteIssuerAddress,
    }: GetAllOffersRequest = await req.json();

    if (!baseCurrency || !quoteCurrency) {
      return NextResponse.json(
        { error: "Missing required currencies." },
        { status: 400 },
      );
    }

    const formatAsset = (currency: string, issuer?: string): Asset =>
      currency === "XRP" ? { currency: "XRP" } : { currency, issuer };
    
    const takerGets = formatAsset(baseCurrency, baseIssuerAddress);
    const takerPays = formatAsset(quoteCurrency, quoteIssuerAddress);

    const sellOffers = await getAllSellOffers(takerGets, takerPays);
    const buyOffers = await getAllBuyOffers(takerGets, takerPays);

    return NextResponse.json({ sellOffers, buyOffers }, { status: 200 });
  } catch (err) {
    console.error("Error listing offers:", err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
