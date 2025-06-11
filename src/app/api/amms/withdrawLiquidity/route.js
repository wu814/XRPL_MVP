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
        result = await withdrawAllLiquidity(standbyWallet, ammAccount);
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

        // Update database with current pool balances
        // Fire-and-forget: Update database in background without blocking the response
        (async () => {
          if (!result.poolDeleted) {
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
                      value: (parseFloat(amount) / 1_000_000).toFixed(6), // Convert drops to XRP
                    };
                  } else {
                    // Token amount (object with currency, issuer, value)
                    return {
                      currency: amount.currency,
                      issuer: amount.issuer,
                      value: parseFloat(amount.value).toFixed(6),
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
                    currency_b: currencyB,
                  })
                  .eq("amm_account", ammAccount);

                if (updateError) {
                  console.error(
                    "❌ Failed to update AMM pool balances:",
                    updateError.message,
                  );
                }
              }
            } catch (dbError) {
              console.error("❌ Error updating database:", dbError.message);
            }
          }
        })();
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
