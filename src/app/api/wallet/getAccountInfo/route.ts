import { NextRequest, NextResponse } from "next/server";
import { getAccountInfo } from "@/utils/xrpl/wallet/getWalletInfo";
import { APIResponse, GetAccountInfoAPIRequest } from "@/types/apiTypes";
import { AccountInfo } from "@/types/xrpl/walletXRPLTypes";

export async function POST(req: NextRequest): Promise<NextResponse<APIResponse<AccountInfo>>> {
  try {
    const { wallet }: GetAccountInfoAPIRequest = await req.json();
    
    if (!wallet?.classicAddress) {
      return NextResponse.json<APIResponse<never>>({ success: false, message: "Missing wallet with classicAddress" }, { status: 400 });
    }

    const info = await getAccountInfo(wallet.classicAddress);
    return NextResponse.json<APIResponse<AccountInfo>>({ success: true, message: "Account info fetched successfully", data: info }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIResponse<never>>(
      { success: false, message: `getAccountInfo failed: ${errorMessage}` },
      { status: 500 },
    );
  }
}
