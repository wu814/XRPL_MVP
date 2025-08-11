import { NextRequest, NextResponse } from "next/server";
import getCompletedOffers from "@/utils/xrpl/offer/getCompletedOffers";

interface GetCompletedOffersRequest {
  sourceWallet: {
    classicAddress: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const { sourceWallet }: GetCompletedOffersRequest = await req.json();

    if (!sourceWallet || !sourceWallet.classicAddress) {
      return NextResponse.json({ error: "Missing Source Wallet address" }, { status: 400 });
    }

    const completedOffers = await getCompletedOffers(sourceWallet);

    return NextResponse.json({ completedOffers }, { status: 200 });
  } catch (error) {
    console.error("API Error:", error instanceof Error ? error.message : 'Unknown error');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
