import { NextRequest, NextResponse } from "next/server";
import ammClawback from "@/utils/xrpl/transaction/ammClawback";
import { Wallet } from "xrpl";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { AMMClawbackAPIRequest, APIResponse } from "@/types/apiTypes";

export async function POST(req: NextRequest): Promise<NextResponse<APIResponse<never>>> {
  try {
    const { 
      issuerWallet, 
      holder, 
      asset, 
      asset2, 
      amount,
      clawTwoAssets 
    }: AMMClawbackAPIRequest = await req.json();

    if (!issuerWallet || !holder || !asset || !asset2) {
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

    const result = await ammClawback(
      wallet,
      holder,
      asset,
      asset2,
      amount,
      clawTwoAssets || false,
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, message: result.message }, { status: 200 });
  } catch (error) {
    console.error("AMM Clawback API error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}
