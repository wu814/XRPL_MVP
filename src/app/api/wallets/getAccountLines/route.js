import { NextResponse } from "next/server";
import { getAccountLines } from "@/utils/xrpl/wallet/getWalletInfo";

export async function POST(req) {
  try {
    const { wallet } = await req.json();
    
    // Support both wallet object and direct address for backward compatibility
    const targetAddress = wallet?.classic_address;
    
    if (!targetAddress) {
      return NextResponse.json({ error: "Missing address or wallet" }, { status: 400 });
    }

    const lines = await getAccountLines(targetAddress);
    return NextResponse.json({ data: lines }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: `getAccountLines failed: ${error.message}` },
      { status: 500 },
    );
  }
}
