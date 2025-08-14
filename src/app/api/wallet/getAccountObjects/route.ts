import { NextRequest, NextResponse } from "next/server";
import { client, connectXrplClient } from "@/utils/xrpl/testnet"; 
import { getAccountObjects } from "@/utils/xrpl/wallet/getWalletInfo";
import { GetAccountObjectsAPIRequest, GetAccountObjectsAPIResponse, APIErrorResponse } from "@/types/api/index";

export async function POST(req: NextRequest) {
  try {
    const { wallet }: GetAccountObjectsAPIRequest = await req.json();
    
    // Support both wallet object and direct address for backward compatibility
    const targetAddress = wallet?.classicAddress;
    
    if (!targetAddress) {
      return NextResponse.json<APIErrorResponse>({ message: "Missing address or wallet" }, { status: 400 });
    }

    await connectXrplClient();
    
    const accountObjects = await getAccountObjects(targetAddress);

    return NextResponse.json<GetAccountObjectsAPIResponse>({ message: "Account objects fetched successfully", data: accountObjects }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIErrorResponse>(
      { message: `getAccountObjects failed: ${errorMessage}` },
      { status: 500 },
    );
  }
}
