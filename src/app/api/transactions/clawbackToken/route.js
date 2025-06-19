import { NextResponse } from "next/server";
import clawbackTokens from "@/utils/xrpl/transaction/clawbackToken";
import { Wallet } from "xrpl";

export async function POST(req) {
  try {
    const { issuerWallet, targetAccountAddress, currency, amount } =
      await req.json();
    console.log(issuerWallet, targetAccountAddress, currency, amount);

    if (!issuerWallet || !targetAccountAddress || !currency || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const wallet = Wallet.fromSeed(issuerWallet.seed);
    if (!wallet) {
      return NextResponse.json(
        { error: "Issuer wallet not found" },
        { status: 404 },
      );
    }

    const result = await clawbackTokens(
      wallet,
      targetAccountAddress,
      currency,
      amount,
    );
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Clawback API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
