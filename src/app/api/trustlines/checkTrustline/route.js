// /app/api/wallets/checkTrustline/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Wallet } from "xrpl";
import { checkTrustline } from "@/utils/xrpl/trustline/setTrustline";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

export async function POST(req) {
  try {
    const { wallet, destination, currency } = await req.json();

    if (!wallet) {
      return NextResponse.json({ error: "Missing wallet" }, { status: 400 });
    }

    if (!destination) {
      return NextResponse.json({ error: "Missing destination" }, { status: 400 });
    }

    if (!currency) {
      return NextResponse.json({ error: "Missing currency" }, { status: 400 });
    }

    // Get seed from Supabase using classicAddress
    const supabase = await createSupabaseAnonClient();
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", wallet.classicAddress)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json(
        { error: "Wallet not found for the provided classicAddress" },
        { status: 404 },
      );
    }

    const xrplWallet = Wallet.fromSeed(walletData.seed);

    const hasTrustline = await checkTrustline(
      xrplWallet,
      destination,
      currency,
    );

    return NextResponse.json({ hasTrustline }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to check trustline." },
      { status: 500 },
    );
  }
}
