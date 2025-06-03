import { NextResponse } from "next/server";
import {
  withdrawLiquidityTwoAsset,
  withdrawLiquidityWithLPToken,
  withdrawAllLiquidity,
  withdrawSingleAsset,
  withdrawAllSingleAsset,
  withdrawSingleAssetWithLPToken,
} from "@/utils/xrpl/amm/withdrawLiquidity";
import getAmmInfo from "@/utils/xrpl/amm/getAmmInfo";
import * as xrpl from "xrpl";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { get } from "http";

export async function POST(req) {
  try {
    const {
      mode,
      currentWalletSeed,
      ammInfo,
      minA,
      minB,
      assetType,
      withdrawAmount,
      lpTokenAmount,
    } = await req.json();

    if (!mode || !currentWalletSeed || !ammInfo) {
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
    const standbyWallet = xrpl.Wallet.fromSeed(currentWalletSeed);
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

         // 🧹 Delete AMM from Supabase if full withdrawal was successful
        if (result?.success) {
          const supabase = await createSupabaseAnonClient();
          const { error: deleteError } = await supabase
            .from("amms")
            .delete()
            .eq("amm_address", ammAccount);

          if (deleteError) {
            console.error("❌ Failed to delete AMM record:", deleteError.message);
          } else {
            console.log(`🧹 Successfully deleted AMM ${ammAccount} from database`);
          }
        }
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
    if (result?.success) {
    // ✅ Check if the AMM still exists on ledger
    const ammStillExists = await getAmmInfo(ammAccount);

    if (!ammStillExists) {
      // 🧹 Delete from Supabase if AMM no longer exists
      const supabase = await createSupabaseAnonClient();
      const { error: deleteError } = await supabase
        .from("amms")
        .delete()
        .eq("amm_address", ammAccount);

      if (deleteError) {
        console.error("❌ Failed to delete AMM record:", deleteError.message);
      } else {
        console.log(`🧹 AMM ${ammAccount} was removed from ledger and deleted from DB`);
        result.poolDeleted = true;
      }
    } else {
      console.log("✅ AMM still exists on ledger; not deleted from DB");
      result.poolDeleted = false;
    }
  }

    return NextResponse.json( result , { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: `Withdrawal failed: ${error.message}` },
      { status: 500 },
    );
  }
}
