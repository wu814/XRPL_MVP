import { NextResponse } from "next/server";
import { client, connectXrplClient } from "@/utils/xrpl/testnet";

export async function POST(req) {
  try {
    const { wallet } = await req.json();
    
    // Support both wallet object and direct address for backward compatibility
    const targetAddress = wallet?.classicAddress;
    
    if (!targetAddress) {
      return NextResponse.json({ error: "Missing address or wallet" }, { status: 400 });
    }

    await connectXrplClient();
    
    const accountObjects = await client.request({
      command: "account_objects",
      account: targetAddress,
      ledger_index: "validated",
    });

    return NextResponse.json({ data: accountObjects.result }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: `getAccountObjects failed: ${error.message}` },
      { status: 500 },
    );
  }
} 