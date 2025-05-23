import { NextRequest, NextResponse } from "next/server";
import * as xrpl from "xrpl";
import {
  addLiquidityTwoAsset,
  addLiquidityLPToken,
  addLiquidityIfEmpty,
  addLiquiditySingleAsset,
  addLiquidityOneAssetLPToken,
} from "@/utils/xrpl/amm/addLiquidity";
import {
  setLPTrustlineFromAMMData,
  checkTrustline,
} from "@/utils/xrpl/wallet/setTrustline";

export async function POST(req) {
  try {
    const {
      depositType,
      walletSeed,
      ammInfo,
      assetA,
      assetB,
      lpTokenOut,
    } = await req.json();

    if (!depositType || !walletSeed || !ammInfo) {
      return NextResponse.json(
        { error: "Missing required parameters: depositType, walletSeed, or ammAccount" },
        { status: 400 }
      );
    }

    // Initialize data
    const ammAccount = ammInfo.account;
    const providerWallet = xrpl.Wallet.fromSeed(walletSeed);
    let result = false;

    const hasLPTrustline = await checkTrustline(providerWallet, ammAccount, ammInfo.lp_token.currency);
    if (!hasLPTrustline) {
      const setTrustlineResult = await setLPTrustlineFromAMMData(providerWallet, ammInfo);
      if (!setTrustlineResult.success) {
        return NextResponse.json(
          { error: "Failed to set LP token trustline." },
          { status: 500 }
        );
      }
      console.log(setTrustlineResult.message);
    }

    switch (depositType) {
      case "twoAsset":
        if (!assetA || !assetB) throw new Error("Missing assetA or assetB");
        result = await addLiquidityTwoAsset(providerWallet, ammAccount, assetA, assetB);
        break;

      case "twoAssetLPToken":
        if (!assetA || !assetB || !lpTokenOut)
          throw new Error("Missing assetA, assetB, or lpTokenOut");
        result = await addLiquidityLPToken(
          providerWallet,
          ammAccount,
          assetA,
          assetB,
          lpTokenOut
        );
        break;

      case "ifEmpty":
        if (!assetA || !assetB) throw new Error("Missing assetA or assetB");
        result = await addLiquidityIfEmpty(providerWallet, ammAccount, assetA, assetB);
        break;

      case "oneAsset":
        if (!assetA) throw new Error("Missing asset");
        result = await addLiquiditySingleAsset(providerWallet, ammAccount, assetA);
        break;

      case "oneAssetLPToken":
        if (!assetA || !lpTokenOut)
          throw new Error("Missing asset or lpTokenOut");
        result = await addLiquidityOneAssetLPToken(
          providerWallet,
          ammAccount,
          assetA,
          lpTokenOut
        );
        break;

      default:
        return NextResponse.json(
          { error: "Invalid depositType specified." },
          { status: 400 }
        );
    }

    if (result) {
      return NextResponse.json({ message: "AMM deposit successful." }, { status: 200 });
    } else {
      return NextResponse.json(
        { success: false, error: "AMM deposit failed." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error adding liquidity", error.message);
    return NextResponse.json(
      { error: error.message || "Unexpected error occurred." },
      { status: 500 }
    );
  }
}
