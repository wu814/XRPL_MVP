import { NextRequest, NextResponse } from "next/server";
import { getAccountInfo } from "@/utils/xrpl/wallet/getWalletInfo";
import { YONAWallet } from "@/types/wallet";

interface GetAccountInfoRequest {
  wallet: YONAWallet;
}

export async function POST(req: NextRequest) {
  try {
    const { wallet }: GetAccountInfoRequest = await req.json();
    
    if (!wallet?.classicAddress) {
      return NextResponse.json({ error: "Missing wallet with classicAddress" }, { status: 400 });
    }

    const info = await getAccountInfo(wallet.classicAddress);
    return NextResponse.json({ data: info }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: `getAccountInfo failed: ${errorMessage}` },
      { status: 500 },
    );
  }
}
