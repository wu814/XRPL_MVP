import { NextRequest, NextResponse } from "next/server";
import { Wallet } from "xrpl";
import {
  addLiquidityTwoAsset,
  addLiquidityLPToken,
  addLiquidityIfEmpty,
  addLiquiditySingleAsset,
  addLiquidityOneAssetLPToken,
} from "@/utils/xrpl/amm/addLiquidity";
import getAmmInfo from "@/utils/xrpl/amm/ammUtils";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

export async function POST(req) {
  try {
    const { depositType, wallet, ammInfo, assetA, assetB, lpTokenOut } =
      await req.json();

    if (!depositType) {
      return NextResponse.json(
        { error: "Missing deposit type" },
        { status: 400 },
      );
    }

    if (!wallet) {
      return NextResponse.json(
        { error: "Missing adder wallet" },
        { status: 400 },
      );
    }

    if (!ammInfo) {
      return NextResponse.json({ error: "Missing amm info" }, { status: 400 });
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

    // Initialize data
    const ammAccount = ammInfo.account;
    const providerWallet = Wallet.fromSeed(walletData.seed);
    let result;

    switch (depositType) {
      case "twoAsset":
        if (!assetA || !assetB) throw new Error("Missing assetA or assetB");
        result = await addLiquidityTwoAsset(
          providerWallet,
          ammAccount,
          assetA,
          assetB,
        );
        break;

      case "twoAssetLPToken":
        if (!assetA || !assetB || !lpTokenOut)
          throw new Error("Missing assetA, assetB, or lpTokenOut");
        result = await addLiquidityLPToken(
          providerWallet,
          ammAccount,
          assetA,
          assetB,
          lpTokenOut,
        );
        break;

      case "ifEmpty":
        if (!assetA || !assetB) throw new Error("Missing assetA or assetB");
        result = await addLiquidityIfEmpty(
          providerWallet,
          ammAccount,
          assetA,
          assetB,
        );
        break;

      case "oneAsset":
        if (!assetA) throw new Error("Missing asset");
        result = await addLiquiditySingleAsset(
          providerWallet,
          ammAccount,
          assetA,
        );
        break;

      case "oneAssetLPToken":
        if (!assetA || !lpTokenOut)
          throw new Error("Missing asset or lpTokenOut");
        result = await addLiquidityOneAssetLPToken(
          providerWallet,
          ammAccount,
          assetA,
          lpTokenOut,
        );
        break;

      default:
        return NextResponse.json(
          { error: "Invalid depositType specified." },
          { status: 400 },
        );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unexpected error occurred." },
      { status: 500 },
    );
  }
}
