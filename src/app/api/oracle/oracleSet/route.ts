import { NextRequest, NextResponse } from "next/server";
import { createLiveCryptoOracle } from "@/utils/xrpl/oracle/orcaleSet";
import { Wallet } from "xrpl";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

interface OracleSetRequest {
  treasuryWallet: {
    classicAddress: string;
  };
  oracleDocumentID: number;
  coinGeckoIDs: string[];
  vsCurrency: string;
}

export async function POST(request: NextRequest) {
  try {
    const { treasuryWallet, oracleDocumentID, coinGeckoIDs, vsCurrency }: OracleSetRequest =
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
    const errorMessage = error instanceof Error ? error.message : 'Failed to set oracle';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
