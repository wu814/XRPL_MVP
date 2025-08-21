import { NextRequest, NextResponse } from "next/server";
import { oracleDelete } from "@/utils/xrpl/oracle/oracleDelete";
import { Wallet } from "xrpl";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

interface OracleDeleteRequest {
  treasuryWallet: {
    classicAddress: string;
  };
  oracleDocumentID: number;
}

export async function POST(request: NextRequest) {
  try {
    const { treasuryWallet, oracleDocumentID }: OracleDeleteRequest = await request.json();

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

    // Delete oracle
    const result = await oracleDelete(wallet, oracleDocumentID);

    return NextResponse.json({
      message: "Oracle deleted successfully!",
      result: result,
    });

  } catch (error) {
    console.error("Error deleting oracle:", error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete oracle';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
