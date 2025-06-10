import { NextRequest, NextResponse } from "next/server";
import * as xrpl from "xrpl";
import {
  addLiquidityTwoAsset,
  addLiquidityLPToken,
  addLiquidityIfEmpty,
  addLiquiditySingleAsset,
  addLiquidityOneAssetLPToken,
} from "@/utils/xrpl/amm/addLiquidity";
import getAmmInfo from "@/utils/xrpl/amm/getAmmInfo";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

export async function POST(req) {
  try {
    const { depositType, walletSeed, ammInfo, assetA, assetB, lpTokenOut } =
      await req.json();

    if (!depositType || !walletSeed || !ammInfo) {
      return NextResponse.json(
        {
          error:
            "Missing required parameters: depositType, walletSeed, or ammAccount",
        },
        { status: 400 },
      );
    }

    // Initialize data
    const ammAccount = ammInfo.account;
    const providerWallet = xrpl.Wallet.fromSeed(walletSeed);
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

    // Update database with current pool balances if operation was successful
    if (result?.success) {
      // Fire-and-forget: Update database in background without blocking the response
      (async () => {
        try {
          const currentAmmInfo = await getAmmInfo(ammAccount);
          
          if (currentAmmInfo) {
            const supabase = await createSupabaseAnonClient();
            
            // Parse current pool amounts from XRPL
            const amount1 = currentAmmInfo.amount;
            const amount2 = currentAmmInfo.amount2;
            
            // Helper function to format currency for database
            const formatCurrencyForDB = (amount) => {
              if (typeof amount === "string") {
                // XRP amount (in drops)
                return {
                  currency: "XRP",
                  value: (parseFloat(amount) / 1_000_000).toFixed(6)
                };
              } else {
                // Token amount (object with currency, issuer, value)
                return {
                  currency: amount.currency,
                  issuer: amount.issuer,
                  value: parseFloat(amount.value).toFixed(6)
                };
              }
            };
            
            // Since currencies are always stored in ascending order, 
            // we can always map amount1 to currency_a and amount2 to currency_b
            const currencyA = formatCurrencyForDB(amount1);
            const currencyB = formatCurrencyForDB(amount2);
            
            // Update database with current pool balances
            const { error: updateError } = await supabase
              .from("amms")
              .update({
                currency_a: currencyA,
                currency_b: currencyB
              })
              .eq("amm_account", ammAccount);

            if (updateError) {
              console.error("❌ Failed to update AMM pool balances:", updateError.message);
            }
          }
        } catch (dbError) {
          console.error("❌ Error updating database:", dbError.message);
        }
      })();
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unexpected error occurred." },
      { status: 500 },
    );
  }
}
