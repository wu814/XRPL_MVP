import { NextRequest, NextResponse } from "next/server";
import { getAccountInfo } from "@/utils/xrpl/wallet/getWalletInfo";

interface GetAccountInfoRequest {
  wallet?: {
    classicAddress: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const { wallet }: GetAccountInfoRequest = await req.json();
    
    // Support both wallet object and direct address for backward compatibility
    const targetAddress = wallet?.classicAddress;
    
    if (!targetAddress) {
      return NextResponse.json({ error: "Missing address or wallet" }, { status: 400 });
    }

    const info = await getAccountInfo(targetAddress);
    return NextResponse.json({ data: info }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: `getAccountInfo failed: ${errorMessage}` },
      { status: 500 },
    );
    }
}
