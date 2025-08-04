import { NextResponse } from "next/server";
import {
  withdrawLiquidityTwoAsset,
  withdrawLiquidityWithLPToken,
  withdrawAllLiquidity,
  withdrawSingleAsset,
  withdrawAllSingleAsset,
  withdrawSingleAssetWithLPToken,
} from "@/utils/xrpl/amm/withdrawLiquidity";
import { getAmmInfo } from "@/utils/xrpl/amm/ammUtils";
import { Wallet } from "xrpl";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { get } from "http";

export async function POST(req) {
  try {
    const {
      mode,
      withdrawerWallet,
      ammInfo,
      minA,
      minB,
      assetType,
      withdrawAmount,
      lpTokenAmount,
    } = await req.json();

    if (!mode || !withdrawerWallet || !ammInfo) {
      return NextResponse.json(
        {
          error:
            "Missing required parameters: mode, withdrawerWallet, or ammAccount",
        },
        { status: 400 },
      );
    }

    // Get seed from Supabase using classicAddress
    const supabase = await createSupabaseAnonClient();
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", withdrawerWallet.classicAddress)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json(
        { error: "Wallet not found for the provided classicAddress" },
        { status: 404 },
      );
    }
    // Initialize data
    const ammAccount = ammInfo.account;
    const withdrawerXrplWallet = Wallet.fromSeed(walletData.seed);
    let result;

    switch (mode) {
      case "twoAsset":
        result = await withdrawLiquidityTwoAsset(
          withdrawerXrplWallet,
          ammAccount,
          minA,
          minB,
        );
        break;

      case "lpToken":
        result = await withdrawLiquidityWithLPToken(
          withdrawerXrplWallet,
          ammAccount,
          lpTokenAmount,
        );
        break;

      case "all":
        result = await withdrawAllLiquidity(withdrawerXrplWallet, ammAccount);
        break;

      case "singleAsset":
        result = await withdrawSingleAsset(
          withdrawerXrplWallet,
          ammAccount,
          assetType,
          withdrawAmount,
        );
        break;

      case "singleAssetAll":
        result = await withdrawAllSingleAsset(
          withdrawerXrplWallet,
          ammAccount,
          assetType,
          withdrawAmount,
        );
        break;

      case "singleAssetLp":
        result = await withdrawSingleAssetWithLPToken(
          withdrawerXrplWallet,
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
    if (result?.success) {
      // ✅ Check if the AMM still exists on ledger
      const ammStillExists = await getAmmInfo(ammAccount);

      if (!ammStillExists || !ammStillExists.success) {
        // 🧹 Delete from Supabase if AMM no longer exists
        const supabase = await createSupabaseAnonClient();
        const { error: deleteError } = await supabase
          .from("amms")
          .delete()
          .eq("amm_account", ammAccount);

        if (deleteError) {
          console.error("❌ Failed to delete AMM record:", deleteError.message);
        } else {
          console.log(
            `🧹 AMM ${ammAccount} was removed from ledger and deleted from DB`,
          );
          result.poolDeleted = true;
        }
      } else {
        console.log("✅ AMM still exists on ledger; not deleted from DB");
        result.poolDeleted = false;
      }
    }

    return NextResponse.json(
      {
        success: result.success,
        message: result.message,
        poolDeleted: result.poolDeleted || false,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: `Withdrawal failed: ${error.message}` },
      { status: 500 },
    );
  }
}
