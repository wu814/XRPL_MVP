import { NextRequest, NextResponse } from "next/server";
import getUserOffers from "@/utils/xrpl/dex/getUserOffers";

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

    return NextResponse.json(
      { success: true, message: "Offers fetched successfully", data: offers }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ success: false, error: `Error fetching offers: ${errorMessage}` }, { status: 500 });
  }
}
