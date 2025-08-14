import { NextRequest, NextResponse } from "next/server";
import { getAccountInfo } from "@/utils/xrpl/wallet/getWalletInfo";
import { GetAccountInfoAPIRequest, GetAccountInfoAPIResponse, APIErrorResponse } from "@/types/api/index";

export async function POST(req: NextRequest) {
  try {
    const { wallet }: GetAccountInfoAPIRequest = await req.json();
    
    if (!wallet?.classicAddress) {
      return NextResponse.json<APIErrorResponse>({ message: "Missing wallet with classicAddress" }, { status: 400 });
    }

    const info = await getAccountInfo(wallet.classicAddress);
    return NextResponse.json<GetAccountInfoAPIResponse>({ message: "Account info fetched successfully", data: info }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIErrorResponse>(
      { message: `getAccountInfo failed: ${errorMessage}` },
      { status: 500 },
    );
  }
}
