import { NextRequest, NextResponse } from "next/server";
import * as xrpl from "xrpl";
import { findAmmPath } from "@/utils/xrpl/pathfind/pathfindEngine";
import { sendCrossCurrencyAmmOnly } from "@/utils/xrpl/transaction/sendCrossCurrency";
import getAmmInfo from "@/utils/xrpl/amm/getAmmInfo";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

export async function POST(req) {
  try {
    const { 
      walletSeed, 
      ammInfo, 
      fromCurrency, 
      toCurrency, 
      fromAmount, 
      slippagePercent = 5,
      estimateOnly = false
    } = await req.json();

    if (!walletSeed || !ammInfo || !fromCurrency || !toCurrency || !fromAmount) {
      return NextResponse.json(
        {
          error: "Missing required parameters: walletSeed, ammInfo, fromCurrency, toCurrency, or fromAmount",
        },
        { status: 400 },
      );
    }

    // Get issuer address from AMM info
    const issuerAddress = ammInfo.amount?.issuer || ammInfo.amount2?.issuer;
    
    if (!issuerAddress && (fromCurrency !== "XRP" || toCurrency !== "XRP")) {
      return NextResponse.json(
        { error: "Issuer address not found in AMM info" },
        { status: 400 },
      );
    }

    console.log(`🔄 AMM swap ${estimateOnly ? 'estimate' : 'execution'}: ${fromAmount} ${fromCurrency} → ${toCurrency}`);

    // Step 1: Find the best AMM path
    const pathfindingResult = await findAmmPath(
      fromCurrency, 
      toCurrency, 
      fromAmount, 
      issuerAddress
    );

    if (!pathfindingResult.success) {
      return NextResponse.json(
        { error: pathfindingResult.error || "No viable AMM path found" },
        { status: 400 },
      );
    }

    console.log(`✅ Found AMM path: ${pathfindingResult.bestPath.type}`);
    console.log(`📊 Rate: ${pathfindingResult.bestRate}`);
    console.log(`💰 Estimated output: ${pathfindingResult.bestPath.estimatedOutput} ${toCurrency}`);

    // If this is just an estimate, return the pathfinding result
    if (estimateOnly) {
      return NextResponse.json({
        success: true,
        pathfindingResult,
        message: "Swap estimate calculated successfully"
      }, { status: 200 });
    }

    // Step 2: Execute the swap using cross-currency payment
    const wallet = xrpl.Wallet.fromSeed(walletSeed);
    
    const swapResult = await sendCrossCurrencyAmmOnly(
      wallet,
      wallet.classicAddress, // Send to self (swap)
      fromCurrency,
      fromAmount,
      toCurrency,
      issuerAddress,
      slippagePercent
    );

    if (!swapResult.success) {
      return NextResponse.json(
        { error: swapResult.error || "Swap execution failed" },
        { status: 500 },
      );
    }

    // Step 3: Update database with current pool balances if operation was successful
    if (swapResult.success) {
      // Fire-and-forget: Update database in background without blocking the response
      (async () => {
        try {
          const currentAmmInfo = await getAmmInfo(ammInfo.account);
          
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
              .eq("amm_account", ammInfo.account);

            if (updateError) {
              console.error("❌ Failed to update AMM pool balances:", updateError.message);
            }
          }
        } catch (dbError) {
          console.error("❌ Error updating database:", dbError.message);
        }
      })();
    }

    return NextResponse.json({
      success: true,
      pathfindingResult,
      swapResult,
      output: `Successfully swapped ${fromAmount} ${fromCurrency} for ${swapResult.actualOutput || pathfindingResult.bestPath.estimatedOutput} ${toCurrency}`
    }, { status: 200 });

  } catch (error) {
    console.error("❌ Swap liquidity error:", error);
    return NextResponse.json(
      { error: error.message || "Unexpected error occurred during swap." },
      { status: 500 },
    );
  }
} 