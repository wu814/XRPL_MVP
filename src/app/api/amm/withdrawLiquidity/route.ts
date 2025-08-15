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

interface WithdrawLiquidityRequest {
  mode: "twoAsset" | "lpToken" | "all" | "singleAsset" | "singleAssetAll" | "singleAssetLp";
  withdrawerWallet: {
    classicAddress: string;
  };
  ammInfo: {
    account: string;
  };
  minA?: string;
  minB?: string;
  assetType?: string;
  withdrawAmount?: string;
  lpTokenAmount?: string;
}

interface WithdrawLiquidityResponse {
  success: boolean;
  message: string;
  poolDeleted?: boolean;
}

export async function POST(req: NextRequest) {
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
    }: WithdrawLiquidityRequest = await req.json();

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
    const withdrawerXrplWallet: Wallet = Wallet.fromSeed(walletData.seed);
    let result: WithdrawLiquidityResponse;

    switch (mode) {
      case "twoAsset":
        if (!minA || !minB) {
          return NextResponse.json(
            { error: "Missing minA or minB for twoAsset mode" },
            { status: 400 },
          );
        }
        result = await withdrawLiquidityTwoAsset(
          withdrawerXrplWallet,
          ammAccount,
          minA,
          minB,
        );
        break;

      case "lpToken":
        if (!lpTokenAmount) {
          return NextResponse.json(
            { error: "Missing lpTokenAmount for lpToken mode" },
            { status: 400 },
          );
        }
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
        if (!assetType || !withdrawAmount) {
          return NextResponse.json(
            { error: "Missing assetType or withdrawAmount for singleAsset mode" },
            { status: 400 },
          );
        }
        result = await withdrawSingleAsset(
          withdrawerXrplWallet,
          ammAccount,
          assetType,
          withdrawAmount,
        );
        break;

      case "singleAssetAll":
        if (!assetType) {
          return NextResponse.json(
            { error: "Missing assetType for singleAssetAll mode" },
            { status: 400 },
          );
        }
        result = await withdrawAllSingleAsset(
          withdrawerXrplWallet,
          ammAccount,
          assetType,
          withdrawAmount,
        );
        break;

      case "singleAssetLp":
        if (!assetType || !lpTokenAmount) {
          return NextResponse.json(
            { error: "Missing assetType or lpTokenAmount for singleAssetLp mode" },
            { status: 400 },
          );
        }
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
      const ammStillExists = await getFormattedAMMInfo(ammAccount);

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: `Withdrawal failed: ${errorMessage}` },
      { status: 500 },
    );
  }
}
