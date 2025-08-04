import { NextResponse } from "next/server";
import {
  setIssuerWalletFlags,
  setTreasuryWalletFlags,
  setPathfindWalletFlags,
} from "@/utils/xrpl/wallet/setWalletFlags";
import { Wallet } from "xrpl";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

export async function POST(req) {
  try {
    const { wallet } = await req.json();

    if (!wallet) {
      return NextResponse.json({ error: "Missing wallet" }, { status: 400 });
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

    switch (wallet.walletType) {
      case "ISSUER":
        await setIssuerWalletFlags(xrplWallet);
        break;
      case "TREASURY":
        await setTreasuryWalletFlags(xrplWallet);
        break;
      case "PATHFIND":
        await setPathfindWalletFlags(xrplWallet);
        break;
      default:
        return NextResponse.json(
          { error: `Unsupported walletType: ${wallet.walletType}` },
          { status: 400 },
        );
    }

    return NextResponse.json(
      { message: `✅ Flags successfully set for ${wallet.walletType} wallet.` },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: `❌ Error setting wallet flags: ${error.message}` },
      { status: 500 },
    );
  }
}
