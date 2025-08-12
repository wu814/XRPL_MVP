import { NextRequest, NextResponse } from "next/server";
import { getAccountLines } from "@/utils/xrpl/wallet/getWalletInfo";

interface GetAccountLinesRequest {
  wallet?: {
    classicAddress: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const { wallet }: GetAccountLinesRequest = await req.json();
    
    // Support both wallet object and direct address for backward compatibility
    const targetAddress = wallet?.classicAddress;
    
    if (!targetAddress) {
      return NextResponse.json({ error: "Missing address or wallet" }, { status: 400 });
    }

    const lines = await getAccountLines(targetAddress);
    return NextResponse.json({ data: lines }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: `getAccountLines failed: ${errorMessage}` },
      { status: 500 },
    );
  }
}
