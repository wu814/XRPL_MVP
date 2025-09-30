import { NextRequest, NextResponse } from "next/server";
import getCompletedOffers from "@/utils/xrpl/dex/getCompletedOffers";
import { APIResponse, GetCompletedOffersAPIRequest } from "@/types/apiTypes";
import { EnhancedCompletedOffer } from "@/types/xrpl/dexXRPLTypes";


export async function POST(req: NextRequest): Promise<NextResponse<APIResponse<EnhancedCompletedOffer[]>>> {
  try {
    const { sourceWallet }: GetCompletedOffersAPIRequest = await req.json();

    if (!sourceWallet || !sourceWallet.classicAddress) {
      return NextResponse.json<APIResponse<never>>({ success: false, message: "Missing Source Wallet address" }, { status: 400 });
    }

    const completedOffers = await getCompletedOffers(sourceWallet);

    return NextResponse.json<APIResponse<EnhancedCompletedOffer[]>>(
      { 
        success: true,
        message: `Found ${completedOffers.length} completed offers`, 
        data: completedOffers 
      }, 
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIResponse<never>>({ success: false, message: errorMessage }, { status: 500 });
  }
}
