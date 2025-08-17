import { NextRequest, NextResponse } from "next/server";
import { Wallet } from "xrpl";
import {
  addLiquidityTwoAsset,
  addLiquiditySingleAsset,
  addLiquidityOneAssetLPToken,
  addLiquidityTwoAssetLPToken,
} from "@/utils/xrpl/amm/addLiquidity";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { AddLiquidityAPIRequest, AddLiquidityAPIResponse } from "@/types/api/ammAPITypes";
import { APIErrorResponse } from "@/types/api/errorAPITypes";
import { AddLiquidityResult } from "@/types/xrpl/ammXRPLTypes";

export async function POST(req: NextRequest): Promise<NextResponse<AddLiquidityAPIResponse | APIErrorResponse>>  {
  try {
    const { depositType, wallet, ammInfo, formattedAmount1, formattedAmount2, lpTokenOut, emptyAmount }: AddLiquidityAPIRequest =
      await req.json();

    if (!depositType) {
      return NextResponse.json<APIErrorResponse>({ message: "Missing deposit type" }, { status: 400 });
    }

    if (!wallet) {
      return NextResponse.json<APIErrorResponse>({ message: "Missing adder wallet" }, { status: 400 });
    }

    if (!ammInfo) {
      return NextResponse.json<APIErrorResponse>({ message: "Missing amm info" }, { status: 400 });
    }

    // Get seed from Supabase using classicAddress
    const supabase = await createSupabaseAnonClient();
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", wallet.classicAddress)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json<APIErrorResponse>({ message: "Wallet not found for the provided classicAddress" }, { status: 404 });
    }

    // Initialize data
    const ammAccount = ammInfo.account;
    const providerXRPLWallet = Wallet.fromSeed(walletData.seed);
    let result: AddLiquidityResult;

    switch (depositType) {
      case "twoAsset":
        if (!formattedAmount1 || !formattedAmount2){
          return NextResponse.json<APIErrorResponse>({ message: "Missing assetA or assetB" }, { status: 400 });
        }
        result = await addLiquidityTwoAsset({
          providerXRPLWallet,
          ammAccount,
          formattedAmount1,
          formattedAmount2,
        });
        break;

      case "twoAssetLPToken":
        if (!formattedAmount1 || !formattedAmount2 || !lpTokenOut) {
          return NextResponse.json<APIErrorResponse>({ message: "Missing assetA, assetB, or lpTokenOut" }, { status: 400 });
        }
        result = await addLiquidityTwoAssetLPToken({
          providerXRPLWallet,
          ammAccount,
          formattedAmount1,
          formattedAmount2,
          lpTokenOut,
        });
        break;

      case "oneAsset":
        if (!formattedAmount1 || !emptyAmount) {
          return NextResponse.json<APIErrorResponse>({ message: "Missing asset or emptyAmount" }, { status: 400 });
        }
        result = await addLiquiditySingleAsset({
          providerXRPLWallet,
          ammAccount,
          formattedAmount: formattedAmount1,
          emptyAmount,
        });
        break;

      case "oneAssetLPToken":
        if (!formattedAmount1 || !emptyAmount || !lpTokenOut) {
          return NextResponse.json<APIErrorResponse>({ message: "Missing asset, emptyAmount, or lpTokenOut" }, { status: 400 });
        }
        result = await addLiquidityOneAssetLPToken({
          providerXRPLWallet,
          ammAccount,
          formattedAmount: formattedAmount1,
          emptyAmount,
          lpTokenOut,
        });
        break;

      default:
        return NextResponse.json<APIErrorResponse>({ message: "Invalid depositType specified." }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json<APIErrorResponse>({ 
        message: result.error?.message || "Liquidity addition failed" 
      }, { status: 400 });
    }

    return NextResponse.json<AddLiquidityAPIResponse>({ 
      message: result.message || "Liquidity added successfully" 
    }, { status: 200 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIErrorResponse>({ 
      message: errorMessage || "Unexpected error occurred." 
    }, { status: 500 });
  }
}
