import { NextRequest, NextResponse } from "next/server";
import clawbackTokens from "@/utils/xrpl/transaction/clawbackToken";
import { Wallet } from "xrpl";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { ClawbackTokenAPIRequest, APIResponse } from "@/types/apiTypes";

export async function POST(req: NextRequest): Promise<NextResponse<APIResponse<never>>> {
  try {
    const { issuerWallet, targetAccountAddress, currency, amount }: ClawbackTokenAPIRequest =
      await req.json();

    if (!issuerWallet || !targetAccountAddress || !currency || !amount) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
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
        { success: false, message: "Wallet not found for the provided classicAddress" },
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

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, message: result.message }, { status: 200 });
  } catch (error) {
    console.error("Clawback API error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}
