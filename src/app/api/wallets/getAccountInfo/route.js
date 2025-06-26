import { NextResponse } from "next/server";
import { getAccountInfo } from "@/utils/xrpl/wallet/getWalletInfo";

export async function POST(req) {
  try {
    const { address, wallet } = await req.json();
    
    // Support both wallet object and direct address for backward compatibility
    const targetAddress = wallet?.classicAddress || address;
    
    if (!targetAddress) {
      return NextResponse.json({ error: "Missing address or wallet" }, { status: 400 });
    }

    const info = await getAccountInfo(targetAddress);
    return NextResponse.json({ data: info }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: `getAccountInfo failed: ${error.message}` },
      { status: 500 },
    );
  }
}
