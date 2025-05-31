import { NextResponse } from "next/server";
import {
  withdrawLiquidityTwoAsset,
  withdrawLiquidityWithLPToken,
  withdrawAllLiquidity,
  withdrawSingleAsset,
  withdrawAllSingleAsset,
  withdrawSingleAssetWithLPToken,
} from "@/utils/xrpl/amm/withdrawLiquidity";
import * as xrpl from "xrpl";

export async function POST(req) {
  try {
    const {
      mode,
      standbyWalletSeed,
      ammInfo,
      minA,
      minB,
      assetType,
      withdrawAmount,
      lpTokenAmount,
    } = await req.json();

    if (!mode || !standbyWalletSeed || !ammInfo) {
      return NextResponse.json(
        {
          error:
            "Missing required parameters: mode, standbyWallet, or ammAccount",
        },
        { status: 400 },
      );
    }
    // Initialize data
    const ammAccount = ammInfo.account;
    const standbyWallet = xrpl.Wallet.fromSeed(standbyWalletSeed);
    let result;

    switch (mode) {
      case "twoAsset":
        result = await withdrawLiquidityTwoAsset(
          standbyWallet,
          ammAccount,
          minA,
          minB,
        );
        break;

      case "lpToken":
        result = await withdrawLiquidityWithLPToken(
          standbyWallet,
          ammAccount,
          lpTokenAmount,
        );
        break;

      case "all":
        result = await withdrawAllLiquidity(
          standbyWallet,
          ammAccount,
        );
        break;

      case "singleAsset":
        result = await withdrawSingleAsset(
          standbyWallet,
          ammAccount,
          assetType,
          withdrawAmount,
        );
        break;

      case "singleAssetAll":
        result = await withdrawAllSingleAsset(
          standbyWallet,
          ammAccount,
          assetType,
          withdrawAmount,
        );
        break;

      case "singleAssetLp":
        result = await withdrawSingleAssetWithLPToken(
          standbyWallet,
          ammAccount,
          assetType,
          lpTokenAmount,
        );
        break;

      default:
        return NextResponse.json(
          { error: "Invalid mode provided" },
          { status: 400 },
        );
    }

    return NextResponse.json({ result }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: `Withdrawal failed: ${error.message}` },
      { status: 500 },
    );
  }
}
