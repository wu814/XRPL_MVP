import { NextResponse } from "next/server";
import { getAccountInfo } from "@/utils/xrpl/wallet/getWalletInfo"; 

export async function POST(req) {
  try {
    const { address } = await req.json();
    if (!address) {
      return NextResponse.json({ error: "Missing address" }, { status: 400 });
    }

    const info = await getAccountInfo(address);
    return NextResponse.json({ data: info }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: `getAccountInfo failed: ${error.message}` },
      { status: 500 }
    );
  }
}
