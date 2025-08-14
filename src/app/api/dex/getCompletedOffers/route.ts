import { NextRequest, NextResponse } from "next/server";
import getCompletedOffers from "@/utils/xrpl/dex/getCompletedOffers";
import { GetCompletedOffersAPIRequest, GetCompletedOffersAPIResponse, APIErrorResponse } from "@/types/api/index";

export async function POST(req: NextRequest) {
  try {
    const { sourceWallet }: GetCompletedOffersAPIRequest = await req.json();

    if (!sourceWallet || !sourceWallet.classicAddress) {
      return NextResponse.json<APIErrorResponse>({ message: "Missing Source Wallet address" }, { status: 400 });
    }

    const result = await getCompletedOffers(sourceWallet);

    if (!result.success) {
      return NextResponse.json<APIErrorResponse>({ message: result.message }, { status: 500 });
    }

    return NextResponse.json<GetCompletedOffersAPIResponse>({ message: result.message, data: result.data }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIErrorResponse>({ message: errorMessage }, { status: 500 });
  }
}
