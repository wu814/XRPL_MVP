import { NextRequest, NextResponse } from "next/server";
import getUserOffers from "@/utils/xrpl/dex/getUserOffers";
import { GetUserOffersAPIRequest, GetUserOffersAPIResponse } from "@/types/api/dexAPITypes";
import { APIErrorResponse } from "@/types/api/errorAPITypes";


export async function POST(req: NextRequest): Promise<NextResponse<GetUserOffersAPIResponse | APIErrorResponse>> {
  try {
    const { sourceWallet }: GetUserOffersAPIRequest = await req.json();

    if (!sourceWallet || !sourceWallet.classicAddress) {
      return NextResponse.json<APIErrorResponse>(
        { message: "Missing Source Wallet address" }, 
        { status: 400 }
      );
    }

    const offers = await getUserOffers(sourceWallet);
    
    return NextResponse.json<GetUserOffersAPIResponse>(
      {
        message: `Found ${offers.length} offers`,
        data: offers
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIErrorResponse>(
      { message: `Error fetching offers: ${errorMessage}` },
      { status: 500 }
    );
  }
}
