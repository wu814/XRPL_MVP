// app/api/offers/listAllOffers/route.js
import { NextResponse } from "next/server";
import getAllOffers from "@/utils/xrpl/offer/getAllOffers";

export async function POST(req) {
  try {
    const {
      baseCurrency,
      baseIssuerAddress,
      quoteCurrency,
      quoteIssuerAddress,
    } = await req.json();

    if (!baseCurrency || !quoteCurrency) {
      return NextResponse.json(
        { error: "Missing required currencies." },
        { status: 400 },
      );
    }

    const formatAsset = (currency, issuer) =>
      currency === "XRP" ? { currency: "XRP" } : { currency, issuer };
    
    const takerGets = formatAsset(baseCurrency, baseIssuerAddress);
    const takerPays = formatAsset(quoteCurrency, quoteIssuerAddress);

    const offers = await getAllOffers(takerGets, takerPays);

    return NextResponse.json({ offers }, { status: 200 });
  } catch (err) {
    console.error("Error listing offers:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
