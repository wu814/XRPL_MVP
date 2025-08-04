import { NextResponse } from "next/server";
import clawbackTokens from "@/utils/xrpl/transaction/clawbackToken";
import { Wallet } from "xrpl";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

export async function POST(req) {
  try {
    const { issuerWallet, targetAccountAddress, currency, amount } =
      await req.json();

    if (!issuerWallet || !targetAccountAddress || !currency || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Get seed from Supabase using classicAddress
    const supabase = await createSupabaseAnonClient();
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", issuerWallet.classicAddress)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json(
        { error: "Wallet not found for the provided classicAddress" },
        { status: 404 },
      );
    }

    const wallet = Wallet.fromSeed(walletData.seed);

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
