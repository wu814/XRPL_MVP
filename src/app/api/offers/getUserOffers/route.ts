import { NextRequest, NextResponse } from "next/server";
import getUserOffers from "@/utils/xrpl/offer/getUserOffers";

interface GetUserOffersRequest {
  sourceWallet: {
    classicAddress: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const { sourceWallet }: GetUserOffersRequest = await req.json();

    if (!sourceWallet || !sourceWallet.classicAddress) {
      return NextResponse.json({ error: "Missing Source Wallet address" }, { status: 400 });
    }

    const offers = await getUserOffers(sourceWallet);

    return NextResponse.json({ offers }, { status: 200 });
  } catch (error) {
    console.error("API Error:", error instanceof Error ? error.message : 'Unknown error');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
