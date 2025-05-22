import { NextResponse } from "next/server";
import {
  setIssuerWalletFlags,
  setTreasuryWalletFlags,
  setPathfindWalletFlags,
} from "@/utils/xrpl/wallet/setWalletFlags";
import * as xrpl from "xrpl";

export async function POST(req) {
  try {
    const { wallet } = await req.json();

    if (!wallet) {
      return NextResponse.json(
        { error: "Missing wallet information." },
        { status: 400 },
      );
    }

    const walletInstance = xrpl.Wallet.fromSeed(wallet.seed);

    switch (wallet.walletType) {
      case "ISSUER":
        await setIssuerWalletFlags(walletInstance);
        break;
      case "STANDBY TREASURY":
        await setTreasuryWalletFlags(walletInstance);
        break;
      case "STANDBY PATHFIND":
        await setPathfindWalletFlags(walletInstance);
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
