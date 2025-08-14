import { NextRequest, NextResponse } from "next/server";
import getUserOffers from "@/utils/xrpl/dex/getUserOffers";
import { GetUserOffersAPIRequest, GetUserOffersAPIResponse, APIErrorResponse } from "@/types/api/index";
import { GetUserOffersResult } from "@/types/xrpl/index";

export async function POST(req: NextRequest) {
  try {
    const { sourceWallet }: GetUserOffersAPIRequest = await req.json();

    if (!sourceWallet || !sourceWallet.classicAddress) {
      return NextResponse.json<APIErrorResponse>(
        { message: "Missing Source Wallet address" }, 
        { status: 400 }
      );
    }

    const result: GetUserOffersResult = await getUserOffers(sourceWallet);
    
    if (!result.success) {
      return NextResponse.json<APIErrorResponse>(
        { message: result.error || "Failed to fetch offers" },
        { status: 500 }
      );
    }

    return NextResponse.json<GetUserOffersAPIResponse>(
      {
        message: result.message,
        data: result.data
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
