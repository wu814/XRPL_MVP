import { NextRequest, NextResponse } from "next/server";
import { getAccountLines } from "@/utils/xrpl/wallet/getWalletInfo";
import { GetAccountLinesAPIRequest, GetAccountLinesAPIResponse } from "@/types/api/walletAPITypes";
import { APIErrorResponse } from "@/types/api/errorAPITypes";


export async function POST(req: NextRequest): Promise<NextResponse<GetAccountLinesAPIResponse | APIErrorResponse>> {
  try {
    const { wallet }: GetAccountLinesAPIRequest = await req.json();
    
    // Support both wallet object and direct address for backward compatibility
    const targetAddress = wallet?.classicAddress;
    
    if (!targetAddress) {
      return NextResponse.json<APIErrorResponse>({ message: "Missing address or wallet" }, { status: 400 });
    }

    const lines = await getAccountLines(targetAddress);
    return NextResponse.json<GetAccountLinesAPIResponse>({ message: "Account lines fetched successfully", data: lines }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIErrorResponse>(
      { message: `getAccountLines failed: ${errorMessage}` },
      { status: 500 },
    );
  }
}
