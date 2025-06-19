// /app/api/wallets/setLPTrustline/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Wallet } from "xrpl";
import { setLPTrustlineFromAMMData } from "@/utils/xrpl/trustline/setTrustline";

export async function POST(req) {
  try {
    const { walletSeed, ammInfo } = await req.json();

    if (!walletSeed || !ammInfo) {
      return NextResponse.json(
        { error: "Missing walletSeed or ammInfo." },
        { status: 400 },
      );
    }

    const wallet = Wallet.fromSeed(walletSeed);
    const result = await setLPTrustlineFromAMMData(wallet, ammInfo);

    if (!result || !result.success) {
      return NextResponse.json(
        { error: "Failed to set LP token trustline." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: "Trustline set successfully." },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Unexpected error while setting trustline." },
      { status: 500 },
    );
  }
}
