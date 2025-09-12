import { NextRequest, NextResponse } from "next/server";
import getUserOffers from "@/utils/xrpl/dex/getUserOffers";
import { GetUserOffersAPIRequest, APIResponse } from "@/types/apiTypes";
import { EnhancedOffer } from "@/types/xrpl/dexXRPLTypes";

export async function POST(req: NextRequest): Promise<NextResponse<APIResponse<EnhancedOffer[]>>> {
  try {
    const { sourceWallet }: GetUserOffersAPIRequest = await req.json();

    if (!sourceWallet || !sourceWallet.classicAddress) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Missing Source Wallet address" }, 
        { status: 400 }
      );
    }

    const offers = await getUserOffers(sourceWallet);
    
    return NextResponse.json<APIResponse<EnhancedOffer[]>>(
      {
        success: true,
        message: `Found ${offers.length} offers`,
        data: offers
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIResponse<never>>(
      { success: false, message: `Error fetching offers: ${errorMessage}` },
      { status: 500 }
    );
  }
}
