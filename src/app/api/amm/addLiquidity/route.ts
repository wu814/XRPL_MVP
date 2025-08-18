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
    const { depositType, wallet, ammInfo, addValue1, addValue2, lpTokenValue, selectedCurrency }: AddLiquidityAPIRequest =
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
    const providerXRPLWallet = Wallet.fromSeed(walletData.seed);
    let result: AddLiquidityResult;

    switch (depositType) {
      case "twoAsset":
        if (!addValue1 || !addValue2){
          return NextResponse.json<APIErrorResponse>({ message: "Missing asset1 or asset2" }, { status: 400 });
        }
        result = await addLiquidityTwoAsset(
          providerXRPLWallet,
          ammInfo,
          addValue1,
          addValue2,
        );
        break;

      case "twoAssetLPToken":
        if (!addValue1 || !addValue2 || !lpTokenValue) {
          return NextResponse.json<APIErrorResponse>({ message: "Missing asset1, asset2, or lpTokenValue" }, { status: 400 });
        }
        result = await addLiquidityTwoAssetLPToken(
          providerXRPLWallet,
          ammInfo,
          addValue1,
          addValue2,
          lpTokenValue,
        );
        break;

      case "oneAsset":
        if (!addValue1 || !selectedCurrency) {
          return NextResponse.json<APIErrorResponse>({ message: "Missing asset or selectedCurrency" }, { status: 400 });
        }
        result = await addLiquiditySingleAsset(
          providerXRPLWallet,
          ammInfo,
          addValue1,
          selectedCurrency
        );
        break;

      case "oneAssetLPToken":
        if (!addValue1 || !lpTokenValue || !selectedCurrency) {
          return NextResponse.json<APIErrorResponse>({ message: "Missing asset, selectedCurrency, or lpTokenValue" }, { status: 400 });
        }
        result = await addLiquidityOneAssetLPToken(
          providerXRPLWallet,
          ammInfo,
          addValue1,
          selectedCurrency,
          lpTokenValue,
        );
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
