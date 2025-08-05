import { NextResponse } from "next/server";
import { createLiveCryptoOracle } from "@/utils/xrpl/oracle/orcaleSet";
import { Wallet } from "xrpl";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

export async function POST(request) {
  try {
    const { treasuryWallet, oracleDocumentID, coinGeckoIDs, vsCurrency } =
      await request.json();

    // Validate required fields
    if (!treasuryWallet) {
      return NextResponse.json(
        { error: "Missing treasury wallet" },
        { status: 400 },
      );
    }

    if (!oracleDocumentID) {
      return NextResponse.json(
        { error: "Missing oracle document ID" },
        { status: 400 },
      );
    }

    if (!vsCurrency) {
      return NextResponse.json(
        { error: "Missing vsCurrency" },
        { status: 400 },
      );
    }

    if (!coinGeckoIDs) {
      return NextResponse.json(
        { error: "Missing coinGeckoIDs" },
        { status: 400 },
      );
    }

    // Get seed from Supabase using classicAddress
    const supabase = await createSupabaseAnonClient();
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", treasuryWallet.classicAddress)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json(
        { error: "Wallet not found for the provided classicAddress" },
        { status: 404 },
      );
    }

    // Create XRPL wallet object
    const wallet = Wallet.fromSeed(walletData.seed);

    // Create oracle with live crypto prices
    const result = await createLiveCryptoOracle(
      wallet,
      oracleDocumentID,
      coinGeckoIDs,
      vsCurrency,
    );

    return NextResponse.json({
      message: "Oracle set successfully!",
      result: result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to set oracle" },
      { status: 500 },
    );
  }
}
