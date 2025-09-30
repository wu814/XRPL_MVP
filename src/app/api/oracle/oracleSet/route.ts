import { NextRequest, NextResponse } from "next/server";
import { createLiveCryptoOracle } from "@/utils/xrpl/oracle/orcaleSet";
import { Wallet } from "xrpl";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { OracleSetAPIRequest, APIResponse } from "@/types/apiTypes";

export async function POST(request: NextRequest): Promise<NextResponse<APIResponse<never>>> {
  try {
    const { treasuryWallet, oracleDocumentID, coinGeckoIDs, vsCurrency }: OracleSetAPIRequest =
      await request.json();

    // Validate required fields
    if (!treasuryWallet) {
      return NextResponse.json(
        { success: false, message: "Missing treasury wallet" },
        { status: 400 },
      );
    }

    if (!oracleDocumentID) {
      return NextResponse.json(
        { success: false, message: "Missing oracle document ID" },
        { status: 400 },
      );
    }

    if (!vsCurrency) {
      return NextResponse.json(
        { success: false, message: "Missing vsCurrency" },
        { status: 400 },
      );
    }

    if (!coinGeckoIDs) {
      return NextResponse.json(
        { success: false, message: "Missing coinGeckoIDs" },
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
        { success: false, message: "Wallet not found for the provided classicAddress" },
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
      success: true,
      message: "Oracle set successfully!",
      result: result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to set oracle';
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 },
    );
  }
}
