import { NextRequest, NextResponse } from "next/server";
import getCompletedOffers from "@/utils/xrpl/dex/getCompletedOffers";
import { GetCompletedOffersAPIRequest, GetCompletedOffersAPIResponse } from "@/types/api/dexAPITypes";
import { APIErrorResponse } from "@/types/api/errorAPITypes";


export async function POST(req: NextRequest): Promise<NextResponse<GetCompletedOffersAPIResponse | APIErrorResponse>> {
  try {
    const { sourceWallet }: GetCompletedOffersAPIRequest = await req.json();

    if (!sourceWallet || !sourceWallet.classicAddress) {
      return NextResponse.json<APIErrorResponse>({ message: "Missing Source Wallet address" }, { status: 400 });
    }

    const completedOffers = await getCompletedOffers(sourceWallet);

    return NextResponse.json<GetCompletedOffersAPIResponse>(
      { 
        message: `Found ${completedOffers.length} completed offers`, 
        data: completedOffers 
      }, 
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIErrorResponse>({ message: errorMessage }, { status: 500 });
  }
}
