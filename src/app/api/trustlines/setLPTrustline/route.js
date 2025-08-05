// /app/api/wallets/setLPTrustline/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Wallet } from "xrpl";
import { setLPTrustlineFromAMMData } from "@/utils/xrpl/trustline/setTrustline";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

export async function POST(req) {
  try {
    const { setterWallet, ammInfo } = await req.json();

    if (!setterWallet) {
      return NextResponse.json({ error: "Missing setterWallet" }, { status: 400 });
    }

    if (!ammInfo) {
      return NextResponse.json({ error: "Missing ammInfo" }, { status: 400 });
    }

    // Get seed from Supabase using classicAddress
    const supabase = await createSupabaseAnonClient();
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", setterWallet.classicAddress)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json(
        { error: "Wallet not found for the provided classicAddress" },
        { status: 404 },
      );
    }

    const setterXrplWallet = Wallet.fromSeed(walletData.seed);

    const result = await setLPTrustlineFromAMMData(setterXrplWallet, ammInfo);

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
