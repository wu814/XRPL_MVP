// /app/api/wallets/checkTrustline/route.ts
import { NextRequest, NextResponse } from "next/server";
import * as xrpl from "xrpl";
import { checkTrustline } from "@/utils/xrpl/trustline/setTrustline";

export async function POST(req) {
  try {
    const { walletSeed, destination, currency } = await req.json();

    if (!walletSeed || !destination || !currency) {
      return NextResponse.json(
        { error: "Missing walletSeed, destination, or currency." },
        { status: 400 }
      );
    }

    const wallet = xrpl.Wallet.fromSeed(walletSeed);
    const hasTrustline = await checkTrustline(wallet, destination, currency);

    return NextResponse.json({ hasTrustline }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to check trustline." },
      { status: 500 }
    );
  }
}
