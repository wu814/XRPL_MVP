import { NextRequest, NextResponse } from "next/server";
import { Wallet } from "xrpl";
import { setLPTrustlineFromAMMData } from "@/utils/xrpl/trustline/setTrustline";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { SetLPTrustlineAPIRequest, SetLPTrustlineAPIResponse } from "@/types/api/trustlineAPITypes";
import { APIErrorResponse } from "@/types/api/errorAPITypes";


export async function POST(req: NextRequest) {
  try {
    const { setterWallet, lpToken }: SetLPTrustlineAPIRequest = await req.json();

    if (!setterWallet) {
      return NextResponse.json<APIErrorResponse>({ message: "Missing setterWallet" }, { status: 400 });
    }

    if (!lpToken) {
      return NextResponse.json<APIErrorResponse>({ message: "Missing lpToken" }, { status: 400 });
    }

    // Get seed from Supabase using classicAddress
    const supabase = await createSupabaseAnonClient();
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", setterWallet.classicAddress)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json<APIErrorResponse>(
        { message: "Wallet not found for the provided classicAddress" },
        { status: 404 },
      );
    }

    const setterXRPLWallet = Wallet.fromSeed(walletData.seed);

    const result = await setLPTrustlineFromAMMData({ setterXRPLWallet, lpToken });

    if (!result.success) {
      return NextResponse.json<APIErrorResponse>(
        { message: result.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json<SetLPTrustlineAPIResponse>(
      { message: result.message },
      { status: 200 },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unexpected error while setting trustline.';
    return NextResponse.json<APIErrorResponse>(
      { message: errorMessage },
      { status: 500 },
    );
  }
}
