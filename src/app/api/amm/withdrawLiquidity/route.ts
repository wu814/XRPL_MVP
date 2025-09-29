import { NextRequest, NextResponse } from "next/server";
import {
  withdrawLiquidityTwoAsset,
  withdrawLiquidityWithLPToken,
  withdrawAllLiquidity,
  withdrawSingleAsset,
  withdrawAllSingleAsset,
  withdrawSingleAssetWithLPToken,
} from "@/utils/xrpl/amm/withdrawLiquidity";
import { getFormattedAMMInfo } from "@/utils/xrpl/amm/ammUtils";
import { Wallet } from "xrpl";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { APIResponse, WithdrawLiquidityAPIRequest } from "@/types/apiTypes";
import { WithdrawLiquidityResult } from "@/types/xrpl/ammXRPLTypes";


export async function POST(
  req: NextRequest,
): Promise<NextResponse<APIResponse<{ poolDeleted: boolean }>>> {

  try {
    const {
      mode,
      withdrawerWallet,
      ammInfo,
      withdrawValue1,
      withdrawValue2,
      singleWithdrawCurrency,
      singleWithdrawValue,
      lpTokenValue,
    }: WithdrawLiquidityAPIRequest = await req.json();

    if (!mode) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Missing mode" },
        { status: 400 },
      );
    }

    if (!withdrawerWallet) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Missing withdrawerWallet"},
        { status: 400 },
      );
    }

    if (!ammInfo) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Missing ammInfo"},
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
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Wallet not found for the provided classicAddress"},
        { status: 404 },
      );
    }

    // Initialize data
    const ammAccount = ammInfo.account;
    const withdrawerXRPLWallet: Wallet = Wallet.fromSeed(walletData.seed);
    let result: WithdrawLiquidityResult;

    switch (mode) {
      case "twoAsset":
        if (!withdrawValue1 || !withdrawValue2) {
          return NextResponse.json<APIResponse<never>>(
            {
              message:
                "Missing withdrawValue1 or withdrawValue2 for twoAsset mode",
              success: false,
            },
            { status: 400 },
          );
        }
        result = await withdrawLiquidityTwoAsset(
          withdrawerXRPLWallet,
          withdrawValue1,
          withdrawValue2,
          ammInfo,
        );
        break;

      case "lpToken":
        if (!lpTokenValue) {
          return NextResponse.json<APIResponse<never>>(
            { success: false, message: "Missing lpTokenValue for lpToken mode"},
            { status: 400 },
          );
        }
        result = await withdrawLiquidityWithLPToken(
          withdrawerXRPLWallet,
          ammInfo,
          lpTokenValue,
        );
        break;

      case "all":
        result = await withdrawAllLiquidity(withdrawerXRPLWallet, ammInfo);
        break;

      case "singleAsset":
        if (!singleWithdrawCurrency || !singleWithdrawValue) {
          return NextResponse.json<APIResponse<never>>(
            {
              message:
                "Missing singleWithdrawCurrency or singleWithdrawValue for singleAsset mode",
              success: false,
            },
            { status: 400 },
          );
        }
        result = await withdrawSingleAsset(
          withdrawerXRPLWallet,
          ammInfo,
          singleWithdrawCurrency,
          singleWithdrawValue,
        );
        break;

      case "singleAssetAll":
        if (!singleWithdrawCurrency) {
          return NextResponse.json<APIResponse<never>>(
            {
              message: "Missing singleWithdrawCurrency for singleAssetAll mode",
              success: false,
            },
            { status: 400 },
          );
        }
        result = await withdrawAllSingleAsset(
          withdrawerXRPLWallet,
          ammInfo,
          singleWithdrawCurrency,
        );
        break;

      case "singleAssetLp":
        if (!singleWithdrawCurrency || !lpTokenValue) {
          return NextResponse.json<APIResponse<never>>(
            {
              message:
                "Missing singleWithdrawCurrency or lpTokenValue for singleAssetLp mode",
              success: false,
            },
            { status: 400 },
          );
        }
        result = await withdrawSingleAssetWithLPToken(
          withdrawerXRPLWallet,
          ammInfo,
          singleWithdrawCurrency,
          lpTokenValue,
        );
        break;

      default:
        return NextResponse.json<APIResponse<never>>(
          { success: false, message: "Invalid mode provided"},
          { status: 400 },
        );
    }
    let poolDeleted = false;
    if (result?.success) {
      // ✅ Check if the AMM still exists on ledger
      const ammStillExists = await getFormattedAMMInfo(ammAccount);

      if (!ammStillExists) {
        // 🧹 Delete from Supabase if AMM no longer exists
        const supabase = await createSupabaseAnonClient();
        const { error: deleteError } = await supabase
          .from("amms")
          .delete()
          .eq("account", ammAccount);

        if (deleteError) {
          console.error("❌ Failed to delete AMM record:", deleteError.message);
        } else {
          console.log(
            `🧹 AMM ${ammAccount} was removed from ledger and deleted from DB`,
          );
          poolDeleted = true;
        }
      } else {
        console.log("✅ AMM still exists on ledger; not deleted from DB");
        poolDeleted = false;
      }
    } else {
      return NextResponse.json<APIResponse<never>>(
          { success: false, message: result.message},
        { status: 500 },
      );
    }

    return NextResponse.json<APIResponse<{ poolDeleted: boolean }>>(
      {
        success: true,
        message: result.message,
        data: { poolDeleted: poolDeleted }, 
      },
      { status: 200 },
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json<APIResponse<never>>(
      { success: false, message: `Withdrawal failed: ${errorMessage}`},
      { status: 500 },
    );
  }
}
