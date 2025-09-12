import { NextRequest, NextResponse } from "next/server";
import {
  setIssuerWalletFlags,
  setTreasuryWalletFlags,
  setPathfindWalletFlags,
} from "@/utils/xrpl/wallet/setWalletFlags";
import { Wallet } from "xrpl";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { APIResponse, SetWalletFlagsAPIRequest } from "@/types/apiTypes";
import { SetWalletFlagsResult } from "@/types/xrpl/walletXRPLTypes";


export async function POST(req: NextRequest): Promise<NextResponse<APIResponse<never>>> {
  try {
    const { wallet }: SetWalletFlagsAPIRequest = await req.json();

    if (!wallet) {
      return NextResponse.json<APIResponse<never>>({ success: false, message: "Missing wallet" }, { status: 400 });
    }

    // Get seed from Supabase using classicAddress
    const supabase = await createSupabaseAnonClient();
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", wallet.classicAddress)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Wallet not found for the provided classicAddress" },
        { status: 404 },
      );
    }

    const xrplWallet = Wallet.fromSeed(walletData.seed);
    let result: SetWalletFlagsResult;

    switch (wallet.walletType) {
      case "ISSUER":
        result = await setIssuerWalletFlags(xrplWallet);
        break;
      case "TREASURY":
        result = await setTreasuryWalletFlags(xrplWallet);
        break;
      case "PATHFIND":
        result = await setPathfindWalletFlags(xrplWallet);
        break;
      default:
        return NextResponse.json<APIResponse<never>>(
          { success: false, message: `Unsupported walletType: ${wallet.walletType}` },
          { status: 400 },
        );
    }

    if (!result.success) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: `❌ Error setting wallet flags: ${result.error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json<APIResponse<never>>(
      { success: true, message: `✅ Flags successfully set for ${wallet.walletType} wallet.` },
      { status: 200 },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIResponse<never>>(
      { success: false, message: `❌ Error setting wallet flags: ${errorMessage}` },
      { status: 500 },
    );
  }
}
