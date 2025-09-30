import { NextRequest, NextResponse } from "next/server";
import { connectXRPLClient } from "@/utils/xrpl/testnet"; 
import { getAccountObjects } from "@/utils/xrpl/wallet/getWalletInfo";
import { APIResponse, GetAccountObjectsAPIRequest } from "@/types/apiTypes";
import { AccountObject } from "xrpl";


export async function POST(req: NextRequest): Promise<NextResponse<APIResponse<AccountObject[]>>> {
  try {
    const { wallet }: GetAccountObjectsAPIRequest = await req.json();
    
    // Support both wallet object and direct address for backward compatibility
    const targetAddress = wallet?.classicAddress;
    
    if (!targetAddress) {
      return NextResponse.json<APIResponse<never>>({ success: false, message: "Missing address or wallet" }, { status: 400 });
    }

    await connectXRPLClient();
    
    const accountObjects = await getAccountObjects(targetAddress);

    return NextResponse.json<APIResponse<AccountObject[]>>({ success: true, message: "Account objects fetched successfully", data: accountObjects }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIResponse<never>>(
      { success: false, message: `getAccountObjects failed: ${errorMessage}` },
      { status: 500 },
    );
  }
}
