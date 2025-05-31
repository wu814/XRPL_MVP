import * as xrpl from "xrpl";
import fs from "fs";
import path from "path";
import BigNumber from "bignumber.js";

import getAmmInfo from  "./getAmmInfo";
import { client, connectXrplClient } from "../testnet"; // or adjust to "../../client" if needed
import { checkTrustline } from "@/utils/xrpl/wallet/setTrustline";


// Two-asset withdraw - withdraw both assets specifying minimum amounts
// The standby wallet performs the withdrawal on behalf of an operational wallet
export async function withdrawLiquidityTwoAsset (standbyWallet, ammAccount, minWithdrawalA, minWithdrawalB, operationalWalletInfo = null) {
    try {
      await connectXrplClient();
      console.log(`🔍 Getting AMM data for account: ${ammAccount}`);
      const ammData = await getAmmInfo(ammAccount);
      
      console.log(`🔍 AMM Data received:`, JSON.stringify(ammData, null, 2));
      
      if (!ammData) {
        console.error(`❌ Error: AMM data not found for account ${ammAccount}`);
        return false;
      }
      
      // Verify that amount and amount2 exist in the AMM data
      if (!ammData.amount || !ammData.amount2) {
        console.error(`❌ Error: Invalid AMM data structure - missing asset information`);
        console.log("AMM Data received:", JSON.stringify(ammData, null, 2));
        return false;
      }
      
      const assetA = ammData.amount;
      const assetB = ammData.amount2;
      
      // Add better validation and logging for asset objects
      console.log(`Asset A details:`, JSON.stringify(assetA, null, 2));
      console.log(`Asset B details:`, JSON.stringify(assetB, null, 2));
      
      // Double-check that we have currency information for both assets
      if (typeof assetA !== 'string' && !assetA.currency) {
        console.error(`❌ Error: Missing currency information for Asset A`);
        console.log("Asset A received:", JSON.stringify(assetA, null, 2));
        return false;
      }
      
      if (typeof assetB !== 'string' && !assetB.currency) {
        console.error(`❌ Error: Missing currency information for Asset B`);
        console.log("Asset B received:", JSON.stringify(assetB, null, 2));
        return false;
      }
      
      // Log detection of asset types to help debug
      let assetAType = typeof assetA === 'string' ? 'XRP (string)' : 
        (assetA.currency === 'XRP' ? 'XRP (object)' : `Token (${assetA.currency})`);
      let assetBType = typeof assetB === 'string' ? 'XRP (string)' : 
        (assetB.currency === 'XRP' ? 'XRP (object)' : `Token (${assetB.currency})`);
      
      console.log(`🔍 Detected asset types: Asset A = ${assetAType}, Asset B = ${assetBType}`);
      
      // Verify that we have valid LP token data
      if (!ammData.lp_token) {
        console.error(`❌ Error: Invalid AMM data structure - missing LP token information`);
        return false;
      }
      
      const lpToken = ammData.lp_token;
      
      // Log action differently depending on whether this is for an operational wallet or not
      if (operationalWalletInfo) {
        console.log(
          `✅ Withdrawing liquidity from AMM at ${ammAccount} with minimum amounts: ${assetA.currency}=${minWithdrawalA}, ${assetB.currency}=${minWithdrawalB} on behalf of operational wallet ${operationalWalletInfo.classicAddress}`
        );
      } else {
        console.log(
          `✅ Withdrawing liquidity from AMM at ${ammAccount} with minimum amounts: ${assetA.currency}=${minWithdrawalA}, ${assetB.currency}=${minWithdrawalB}`
        );
      }
  
      // Convert pool and desired amounts to BigNumber with 6 decimals (round down).
      const totalPoolA = new BigNumber(assetA.value || 0);
      const totalPoolB = new BigNumber(assetB.value || 0);
      const totalLP = new BigNumber(lpToken.value || 0);
      
      // Store original input amounts for return values
      const originalMinA = minWithdrawalA;
      const originalMinB = minWithdrawalB;
      
      // Define desiredA and desiredB variables that will be used by both paths
      let desiredA = new BigNumber(minWithdrawalA).decimalPlaces(6, BigNumber.ROUND_DOWN);
      let desiredB = new BigNumber(minWithdrawalB).decimalPlaces(6, BigNumber.ROUND_DOWN);
      let requiredLP = "0";
      
      // Check if we're dealing with a minimal withdrawal
      const isMinimalWithdrawal = new BigNumber(minWithdrawalA).isLessThanOrEqualTo(2) && 
                                 new BigNumber(minWithdrawalB).isLessThanOrEqualTo(2);
      
      // For minimal withdrawals, calculate exact proportional LP tokens needed
      if (isMinimalWithdrawal) {
        console.log(`ℹ️ Detected minimal withdrawal amounts (${minWithdrawalA}, ${minWithdrawalB})`);
        
        // Calculate the exact proportion of the pool being withdrawn
        const poolARatio = desiredA.dividedBy(totalPoolA);
        const poolBRatio = desiredB.dividedBy(totalPoolB);
        
        // Use the larger ratio to ensure both minimum amounts are met
        const withdrawalRatio = BigNumber.max(poolARatio, poolBRatio);
        
        // Calculate LP tokens needed - with minimal buffer (1%)
        const proportionalLPAmount = totalLP.multipliedBy(withdrawalRatio).multipliedBy(1.01)
          .decimalPlaces(6, BigNumber.ROUND_UP);
        
        // For transparency, display exactly what's happening
        console.log(`🧮 Withdrawal calculation:`);
        console.log(`   • You are withdrawing ${desiredA.toFixed(6)} XRP of ${totalPoolA.toFixed(6)} total (${poolARatio.multipliedBy(100).toFixed(4)}%)`);
        console.log(`   • You are withdrawing ${desiredB.toFixed(6)} USD of ${totalPoolB.toFixed(6)} total (${poolBRatio.multipliedBy(100).toFixed(4)}%)`);
        console.log(`   • Using the larger percentage: ${withdrawalRatio.multipliedBy(100).toFixed(4)}%`);
        console.log(`   • ${withdrawalRatio.multipliedBy(100).toFixed(4)}% of ${totalLP.toFixed(6)} LP tokens = ${totalLP.multipliedBy(withdrawalRatio).toFixed(6)}`);
        console.log(`   • Adding 1% buffer for slippage = ${proportionalLPAmount.toFixed(6)}`);
        
        // Use this exact LP token amount directly 
        requiredLP = proportionalLPAmount.toFixed(6);
        
        console.log(`🔹 Using ${requiredLP} LP tokens for withdrawal (${withdrawalRatio.multipliedBy(100).toFixed(2)}% of pool + 1% buffer)`);
      } else {
      // Calculate the required LP tokens to redeem:
      // requiredLP_A = (desiredA * totalLP) / totalPoolA
      // requiredLP_B = (desiredB * totalLP) / totalPoolB
      // Use the maximum so that both minimums are met.
      // Add validation to prevent NaN values
      let requiredLP_A = new BigNumber(0);
      let requiredLP_B = new BigNumber(0);
      
      try {
        if (!totalPoolA.isZero() && !totalLP.isZero()) {
          requiredLP_A = desiredA.multipliedBy(totalLP).dividedBy(totalPoolA);
            console.log(`Calculated LP tokens from Asset A: ${requiredLP_A.toFixed(6)}`);
        }
        
        if (!totalPoolB.isZero() && !totalLP.isZero()) {
          requiredLP_B = desiredB.multipliedBy(totalLP).dividedBy(totalPoolB);
            console.log(`Calculated LP tokens from Asset B: ${requiredLP_B.toFixed(6)}`);
        }
        
        // Check if any value is NaN or infinity
        if (requiredLP_A.isNaN() || requiredLP_A.isNegative() || !requiredLP_A.isFinite()) {
          console.warn(`⚠️ Invalid requiredLP_A value, using fallback calculation`);
          requiredLP_A = new BigNumber(0);
        }
        
        if (requiredLP_B.isNaN() || requiredLP_B.isNegative() || !requiredLP_B.isFinite()) {
          console.warn(`⚠️ Invalid requiredLP_B value, using fallback calculation`);
          requiredLP_B = new BigNumber(0);
        }
        
        // Use maximum of the two values that are valid
        if (requiredLP_A.isZero() && requiredLP_B.isZero()) {
          // If both are zero, use a small default value (0.1% of total LP tokens)
          requiredLP = totalLP.multipliedBy(0.001).decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed(6);
          console.warn(`⚠️ Both LP token calculations resulted in zero, using 0.1% of total LP supply: ${requiredLP}`);
        } else if (requiredLP_A.isZero()) {
          requiredLP = requiredLP_B.decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed(6);
        } else if (requiredLP_B.isZero()) {
          requiredLP = requiredLP_A.decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed(6);
        } else {
          requiredLP = BigNumber.maximum(requiredLP_A, requiredLP_B)
                          .decimalPlaces(6, BigNumber.ROUND_DOWN)
                          .toFixed(6);
        }
          
          // If the calculated LP token amount is unreasonably high compared to the minimum withdrawal amounts,
          // it probably means we're dealing with a small withdrawal from a large pool
          if (new BigNumber(requiredLP).isGreaterThan(totalLP.multipliedBy(0.01))) {
            console.log(`⚠️ Calculated LP token amount (${requiredLP}) seems high compared to totalLP (${totalLP.toString()})`);
            console.log(`⚠️ Restricting to a maximum of 1% of total LP tokens`);
            requiredLP = totalLP.multipliedBy(0.01).decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed(6);
          }
      } catch (err) {
        // Fallback in case of any calculation error
        console.error(`❌ Error calculating required LP tokens: ${err.message}`);
        requiredLP = totalLP.multipliedBy(0.001).decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed(6);
        console.warn(`⚠️ Using fallback LP token amount of 0.1% of total LP supply: ${requiredLP}`);
      }
      
      console.log(`🔹 Calculated required LP tokens to redeem: ${requiredLP}`);
      }
  
      // Create assets with special handling for XRP
      let assetObjA, assetObjB, amountObjA, amountObjB;
      
      // Handle Asset A - improved error handling
      if (typeof assetA === 'string') {
        // If assetA is a string, it's XRP in drops
        console.log(`Asset A is a string (${assetA}), treating as XRP`);
        assetObjA = "XRP";
        amountObjA = xrpl.xrpToDrops(desiredA.toFixed(6));
      } else if (assetA.currency === "XRP") {
        console.log(`Asset A has currency "XRP", treating as XRP`);
        assetObjA = "XRP";
        amountObjA = xrpl.xrpToDrops(desiredA.toFixed(6));
      } else if (assetA.currency) {
        console.log(`Asset A is token ${assetA.currency}`);
        assetObjA = {
          currency: assetA.currency,
          issuer: assetA.issuer
        };
        amountObjA = {
          currency: assetA.currency,
          issuer: assetA.issuer,
          value: desiredA.toFixed(6)
        };
      } else {
        console.error(`❌ Cannot determine type of Asset A:`, JSON.stringify(assetA, null, 2));
        throw new Error(`Invalid Asset A format: ${JSON.stringify(assetA)}`);
      }
      
      // Handle Asset B - improved error handling
      if (typeof assetB === 'string') {
        // If assetB is a string, it's XRP in drops
        console.log(`Asset B is a string (${assetB}), treating as XRP`);
        assetObjB = "XRP";
        amountObjB = xrpl.xrpToDrops(desiredB.toFixed(6));
      } else if (assetB.currency === "XRP") {
        console.log(`Asset B has currency "XRP", treating as XRP`);
        assetObjB = "XRP";
        amountObjB = xrpl.xrpToDrops(desiredB.toFixed(6));
      } else if (assetB.currency) {
        console.log(`Asset B is token ${assetB.currency}`);
        assetObjB = {
          currency: assetB.currency,
          issuer: assetB.issuer
        };
        amountObjB = {
          currency: assetB.currency,
          issuer: assetB.issuer,
          value: desiredB.toFixed(6)
        };
      } else {
        console.error(`❌ Cannot determine type of Asset B:`, JSON.stringify(assetB, null, 2));
        throw new Error(`Invalid Asset B format: ${JSON.stringify(assetB)}`);
      }
      
      // Additional validation before constructing transaction
      if (!assetObjA) {
        throw new Error("Asset A object is undefined or null");
      }
      if (!assetObjB) {
        throw new Error("Asset B object is undefined or null");
      }
      
      console.log(`Final Asset Objects:`);
      console.log(`Asset A:`, JSON.stringify(assetObjA, null, 2));
      console.log(`Asset B:`, JSON.stringify(assetObjB, null, 2));

      // Add debugging
      console.log("🔍 Asset Object A:", JSON.stringify(assetObjA, null, 2));
      console.log("🔍 Asset Object B:", JSON.stringify(assetObjB, null, 2));

      // Build the AMMWithdraw transaction.
      const ammWithdrawTx = {
        TransactionType: "AMMWithdraw",
        Account: standbyWallet.classicAddress,
        Asset: assetA.currency === "XRP" ? { currency: "XRP" } : { currency: assetA.currency, issuer: assetA.issuer },
        Asset2: assetB.currency === "XRP" ? { currency: "XRP" } : { currency: assetB.currency, issuer: assetB.issuer },
        Amount: amountObjA,
        Amount2: amountObjB,
        // Use the tfTwoAsset flag (0x00100000 = 1048576) to indicate a two-asset withdrawal.
        Flags: 1048576,
        AMMAccount: ammAccount
    };
  
    // If this is for an operational wallet, add destination tag
    if (operationalWalletInfo && operationalWalletInfo.destTag) {
      ammWithdrawTx.DestinationTag = operationalWalletInfo.destTag;
    }
    
    console.log("📜 Preparing AMMWithdraw transaction...");
    console.log("📜 Transaction details:", JSON.stringify(ammWithdrawTx, null, 2));
    
    // Set LastLedgerSequence to ensure transaction doesn't hang
    const ledgerResponse = await client.request({ command: "ledger_current" });
    const currentLedger = ledgerResponse.result.ledger_current_index;
    
    const preparedTx = await client.autofill(ammWithdrawTx);
    preparedTx.LastLedgerSequence = currentLedger + 50;
    
    console.log("📜 Prepared AMMWithdraw transaction:", JSON.stringify(preparedTx, null, 2));

    const signedTx = standbyWallet.sign(preparedTx);
    console.log("🚀 Submitting liquidity withdrawal...");
    
    const response = await client.submitAndWait(signedTx.tx_blob);
    
    if (response.result.meta.TransactionResult === "tesSUCCESS") {
      // Format LP token amount with proper precision
      const formattedLP = new BigNumber(requiredLP).toFixed(6);
      const lpUnit = formattedLP === "1.000000" ? "LP token" : "LP tokens";
      console.log(`✅ Liquidity withdrawn successfully! Redeemed ${formattedLP} ${lpUnit}.`);
      
      // Extract the actual amounts withdrawn from the transaction metadata
      const nodes = response.result.meta.AffectedNodes;
      let actualWithdrawnA = null;
      let actualWithdrawnB = null;
      
      // Find the RippleState nodes that reflect the change in balances for tokens
      // and AccountRoot changes for XRP
      for (const node of nodes) {
        // Check for token changes (RippleState)
        if (node.ModifiedNode && node.ModifiedNode.LedgerEntryType === "RippleState") {
          const state = node.ModifiedNode;
          if (state.FinalFields && state.PreviousFields && 
              state.FinalFields.Balance && state.PreviousFields.Balance) {
            
            // Check for Asset A (if it's a token)
            if (!actualWithdrawnA && typeof assetA === 'object' && 
                state.FinalFields.Balance.currency === assetA.currency) {
              // Calculate the change in balance
              const prevBalance = parseFloat(state.PreviousFields.Balance.value);
              const finalBalance = parseFloat(state.FinalFields.Balance.value);
              
              // If the balance decreased (became more negative), that's what was withdrawn
              const diff = Math.abs(finalBalance - prevBalance);
              if (diff > 0) {
                actualWithdrawnA = {
                  currency: state.FinalFields.Balance.currency,
                  value: diff.toFixed(6)
                };
              }
            }
            
            // Check for Asset B (if it's a token)
            if (!actualWithdrawnB && typeof assetB === 'object' && 
                state.FinalFields.Balance.currency === assetB.currency) {
              // Calculate the change in balance
              const prevBalance = parseFloat(state.PreviousFields.Balance.value);
              const finalBalance = parseFloat(state.FinalFields.Balance.value);
              
              // If the balance decreased (became more negative), that's what was withdrawn
              const diff = Math.abs(finalBalance - prevBalance);
              if (diff > 0) {
                actualWithdrawnB = {
                  currency: state.FinalFields.Balance.currency,
                  value: diff.toFixed(6)
                };
              }
            }
          }
        }
        
        // Check for XRP changes (AccountRoot)
        else if (node.ModifiedNode && node.ModifiedNode.LedgerEntryType === "AccountRoot") {
          const state = node.ModifiedNode;
          if (state.FinalFields && state.PreviousFields && 
              state.FinalFields.Account === standbyWallet.classicAddress) {
              
            // Check if this is the wallet's XRP balance change
            if (state.FinalFields.Balance && state.PreviousFields.Balance) {
              const prevBalance = new BigNumber(state.PreviousFields.Balance);
              const finalBalance = new BigNumber(state.FinalFields.Balance);
              
              // If the balance increased, that's XRP being withdrawn from AMM
              if (finalBalance.isGreaterThan(prevBalance)) {
                const xrpDiff = finalBalance.minus(prevBalance);
                const xrpAmount = xrpDiff.dividedBy(1000000).toFixed(6); // Convert drops to XRP
                
                // Check if this is Asset A or Asset B
                if ((typeof assetA === 'string' || (typeof assetA === 'object' && assetA.currency === "XRP")) && !actualWithdrawnA) {
                  actualWithdrawnA = {
                    currency: "XRP",
                    value: xrpAmount
                  };
                } else if ((typeof assetB === 'string' || (typeof assetB === 'object' && assetB.currency === "XRP")) && !actualWithdrawnB) {
                  actualWithdrawnB = {
                    currency: "XRP",
                    value: xrpAmount
                  };
                }
              }
            }
          }
        }
      }
      
      console.log("\n===== Transaction Summary =====");
      console.log(`🔹 Transaction Hash: ${response.result.hash}`);
      
      console.log(`\n📤 Withdrawn Amounts:`);
      if (actualWithdrawnA) {
        console.log(`   ${actualWithdrawnA.value} ${actualWithdrawnA.currency}`);
        console.log(`   (Minimum requested: ${originalMinA.toString()} ${assetA.currency})`);
      } else {
        console.log(`   At least ${originalMinA.toString()} ${assetA.currency}`);
      }
      
      if (actualWithdrawnB) {
        console.log(`   ${actualWithdrawnB.value} ${actualWithdrawnB.currency}`);
        console.log(`   (Minimum requested: ${originalMinB.toString()} ${assetB.currency})`);
      } else {
        console.log(`   At least ${originalMinB.toString()} ${assetB.currency}`);
      }
      
      console.log(`\n🔄 LP Tokens Redeemed: ${formattedLP}`);
      console.log("\n===============================");
      
      // Wait a brief period for the ledger to finalize
      console.log("⏳ Waiting for ledger to finalize...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      
      // If this was done for an operational wallet, return info about the operational wallet
      const operationalInfo = operationalWalletInfo ? 
        { operationalWallet: operationalWalletInfo.classicAddress, destTag: operationalWalletInfo.destTag } : null;
      
      // Return the detailed withdrawal information including currency and issuer
      // Always return the original input values for consistency
      return {
        success: true,
        receivedAmountA: actualWithdrawnA ? actualWithdrawnA.value : originalMinA.toString(),
        receivedAmountB: actualWithdrawnB ? actualWithdrawnB.value : originalMinB.toString(),
        currencyA: assetA.currency,
        currencyB: assetB.currency,
        issuerA: assetA.issuer || null,  // null for XRP
        issuerB: assetB.issuer || null,  // null for XRP
        lpTokensRedeemed: requiredLP,
        tx_hash: response.result.hash,
        tx_result: response.result.meta.TransactionResult,
        operationalInfo
      };
    } else {
      throw new Error(`AMM withdrawal failed: ${response.result.meta.TransactionResult}`);
    }
  } catch (error) {
    console.error("❌ Error withdrawing liquidity:", error.message);
    throw error;
  }
};

// Withdraw by specifying LP token amount to burn
// The standby wallet performs the withdrawal on behalf of an operational wallet
export async function withdrawLiquidityWithLPToken (standbyWallet, ammAccount, lpTokenAmount, operationalWalletInfo = null) {
  try {
    await connectXrplClient();
    // Fix: Pass ammAccount as the first parameter to query by AMM account directly
    const ammData = await getAmmInfo(ammAccount);
    if (!ammData) {
      console.error(`❌ Error: AMM data not found for account ${ammAccount}`);
      return false;
    }
    
    // Verify that amount and amount2 exist in the AMM data
    if (!ammData.amount || !ammData.amount2) {
      console.error(`❌ Error: Invalid AMM data structure - missing asset information`);
      console.log("AMM Data received:", JSON.stringify(ammData, null, 2));
      return false;
    }
    
    // Use the passed ammAccount instead of relying on ammData.amm_account
    const assetA = ammData.amount;
    const assetB = ammData.amount2;
    const lpToken = ammData.lp_token;
    
    // Log action differently depending on whether this is for an operational wallet or not
    if (operationalWalletInfo) {
      const formattedLP = new BigNumber(lpTokenAmount).toFixed(6);
      const lpUnit = formattedLP === "1.000000" ? "LP token" : "LP tokens";
      console.log(`✅ Withdrawing with ${formattedLP} ${lpUnit} from AMM at ${ammAccount} on behalf of operational wallet ${operationalWalletInfo.classicAddress}`);
    } else {
      const formattedLP = new BigNumber(lpTokenAmount).toFixed(6);
      const lpUnit = formattedLP === "1.000000" ? "LP token" : "LP tokens";
      console.log(`✅ Withdrawing with ${formattedLP} ${lpUnit} from AMM at ${ammAccount}`);
    }
    
    // Get LP token balance for the wallet - standby wallet holds the LP tokens
    const accountLinesResponse = await client.request({
      command: "account_lines",
      account: standbyWallet.classicAddress,
      peer: lpToken.issuer
    });
    
    const trustlines = accountLinesResponse.result.lines;
    const lpTrustline = trustlines.find(line => line.currency === lpToken.currency);
    
    if (!lpTrustline || new BigNumber(lpTrustline.balance).isZero()) {
      console.log("❌ No LP tokens found in standby wallet. Nothing to withdraw.");
      return false;
    }
    
    const lpBalance = new BigNumber(lpTrustline.balance).decimalPlaces(6, BigNumber.ROUND_DOWN);
    console.log(`✅ Standby wallet LP token balance: ${lpBalance.toFixed(6)}`);
    
    // Show current AMM pool state
    console.log(`\n📊 Current AMM Pool State:`);
    
    // Get currency names properly - handle both XRP (string) and tokens (objects)
    let selectedAssetCurrency, otherAssetCurrency;
    if (typeof assetA === 'string') {
      selectedAssetCurrency = 'XRP';
    } else {
      selectedAssetCurrency = assetA.currency;
    }
    
    if (typeof assetB === 'string') {
      otherAssetCurrency = 'XRP';
    } else {
      otherAssetCurrency = assetB.currency;
    }
    
    console.log(`   ${selectedAssetCurrency}: ${typeof assetA === 'string' ? xrpl.dropsToXrp(assetA) : assetA.value}`);
    console.log(`   ${otherAssetCurrency}: ${typeof assetB === 'string' ? xrpl.dropsToXrp(assetB) : assetB.value}`);
    console.log(`   LP Tokens: ${ammData.lp_token.value}`);
    
    // Convert to BigNumber with 6 decimals precision
    const totalPoolA = new BigNumber(assetA.value);
    const totalPoolB = new BigNumber(assetB.value);
    const totalLP = new BigNumber(lpToken.value);
    const lpAmount = new BigNumber(lpTokenAmount).decimalPlaces(6, BigNumber.ROUND_DOWN);
    
    // Calculate expected withdrawal amounts
    const expectedA = lpAmount.multipliedBy(totalPoolA).dividedBy(totalLP).decimalPlaces(6, BigNumber.ROUND_DOWN);
    const expectedB = lpAmount.multipliedBy(totalPoolB).dividedBy(totalLP).decimalPlaces(6, BigNumber.ROUND_DOWN);
    
    console.log(`🔹 Expected withdrawal: ${expectedA.toFixed(6)} ${assetA.currency} and ${expectedB.toFixed(6)} ${assetB.currency}`);
    
    // Create assets with special handling for XRP
    let assetObjA, assetObjB;
    
    // Handle Asset A
    if (assetA.currency === "XRP") {
      assetObjA = "XRP";
    } else {
      assetObjA = {
        currency: assetA.currency,
        issuer: assetA.issuer
      };
    }
    
    // Handle Asset B
    if (assetB.currency === "XRP") {
      assetObjB = "XRP";
    } else {
      assetObjB = {
        currency: assetB.currency,
        issuer: assetB.issuer
      };
    }
    
    // Update transaction to include standby wallet as Account
    const ammWithdrawTx = {
      TransactionType: "AMMWithdraw",
      Account: standbyWallet.classicAddress,
      Asset: typeof assetObjA === "string" && assetObjA === "XRP" ? { currency: "XRP" } : assetObjA,
      Asset2: typeof assetObjB === "string" && assetObjB === "XRP" ? { currency: "XRP" } : assetObjB,
      LPTokenIn: {
        currency: lpToken.currency,
        issuer: lpToken.issuer,
        value: lpAmount.toFixed(6)
      },
      // Use only tfLPToken flag (0x00010000 = 65536)
      Flags: 65536
    };
    
    // Add AMMAccount if available
    if (ammAccount) {
      ammWithdrawTx.AMMAccount = ammAccount;
    }
    
    // If this is for an operational wallet, add destination tag
    if (operationalWalletInfo && operationalWalletInfo.destTag) {
      ammWithdrawTx.DestinationTag = operationalWalletInfo.destTag;
    }
    
    console.log("📜 Preparing LP Token AMMWithdraw transaction...");
    console.log("Transaction:", JSON.stringify(ammWithdrawTx, null, 4));
    
    const preparedTx = await client.autofill(ammWithdrawTx);
    
    // Set LastLedgerSequence
    const ledgerResponse = await client.request({ command: "ledger_current" });
    const currentLedger = ledgerResponse.result.ledger_current_index;
    preparedTx.LastLedgerSequence = currentLedger + 50;
    
    const signedTx = standbyWallet.sign(preparedTx);
    console.log("🚀 Submitting LP token withdrawal...");
    const response = await client.submitAndWait(signedTx.tx_blob);
    
    if (response.result.meta.TransactionResult === "tesSUCCESS") {
      console.log(`✅ LP token withdrawal successful!`);
      
      // Extract the actual amounts withdrawn from the transaction metadata
      const nodes = response.result.meta.AffectedNodes;
      let actualWithdrawnA = null;
      let actualWithdrawnB = null;
      
      // Find the RippleState nodes that reflect the change in balances for tokens
      // and AccountRoot changes for XRP
      for (const node of nodes) {
        // Check for token changes (RippleState)
        if (node.ModifiedNode && node.ModifiedNode.LedgerEntryType === "RippleState") {
          const state = node.ModifiedNode;
          if (state.FinalFields && state.PreviousFields && 
              state.FinalFields.Balance && state.PreviousFields.Balance) {
            
            // Check for Asset A (if it's a token)
            if (!actualWithdrawnA && typeof assetA === 'object' && 
                state.FinalFields.Balance.currency === assetA.currency) {
              // Calculate the change in balance
              const prevBalance = parseFloat(state.PreviousFields.Balance.value);
              const finalBalance = parseFloat(state.FinalFields.Balance.value);
              
              // If the balance decreased (became more negative), that's what was withdrawn
              const diff = Math.abs(finalBalance - prevBalance);
              if (diff > 0) {
                actualWithdrawnA = {
                  currency: state.FinalFields.Balance.currency,
                  value: diff.toFixed(6)
                };
              }
            }
            
            // Check for Asset B (if it's a token)
            if (!actualWithdrawnB && state.FinalFields.Balance.currency === (typeof assetB === 'object' ? assetB.currency : null)) {
              // Calculate the change in balance
              const prevBalance = parseFloat(state.PreviousFields.Balance.value);
              const finalBalance = parseFloat(state.FinalFields.Balance.value);
              
              // If the balance decreased (became more negative), that's what was withdrawn
              const diff = Math.abs(finalBalance - prevBalance);
              if (diff > 0) {
                actualWithdrawnB = {
                  currency: state.FinalFields.Balance.currency,
                  value: diff.toFixed(6)
                };
              }
            }
          }
        }
        
        // Check for XRP changes (AccountRoot)
        else if (node.ModifiedNode && node.ModifiedNode.LedgerEntryType === "AccountRoot") {
          const state = node.ModifiedNode;
          if (state.FinalFields && state.PreviousFields && 
              state.FinalFields.Account === standbyWallet.classicAddress) {
              
            // Check if this is the wallet's XRP balance change
            if (state.FinalFields.Balance && state.PreviousFields.Balance) {
              const prevBalance = new BigNumber(state.PreviousFields.Balance);
              const finalBalance = new BigNumber(state.FinalFields.Balance);
              
              // If the balance increased, that's XRP being withdrawn from AMM
              if (finalBalance.isGreaterThan(prevBalance)) {
                const xrpDiff = finalBalance.minus(prevBalance);
                const xrpAmount = xrpDiff.dividedBy(1000000).toFixed(6); // Convert drops to XRP
                
                // Check if this is Asset A or Asset B
                if ((typeof assetA === 'string' || (typeof assetA === 'object' && assetA.currency === "XRP")) && !actualWithdrawnA) {
                  actualWithdrawnA = {
                    currency: "XRP",
                    value: xrpAmount
                  };
                } else if ((typeof assetB === 'string' || (typeof assetB === 'object' && assetB.currency === "XRP")) && !actualWithdrawnB) {
                  actualWithdrawnB = {
                    currency: "XRP",
                    value: xrpAmount
                  };
                }
              }
            }
          }
        }
      }
      
      console.log("\n===== Transaction Summary =====");
      console.log(`🔹 Transaction Hash: ${response.result.hash}`);
      
      console.log(`\n📤 Withdrawn Amounts:`);
      if (actualWithdrawnA) {
        console.log(`   ${actualWithdrawnA.value} ${actualWithdrawnA.currency}`);
      } else {
        console.log(`   ~${expectedA.toFixed(6)} ${assetA.currency} (estimated)`);
      }
      
      if (actualWithdrawnB) {
        console.log(`   ${actualWithdrawnB.value} ${actualWithdrawnB.currency}`);
      } else {
        console.log(`   ~${expectedB.toFixed(6)} ${assetB.currency} (estimated)`);
      }
      
      console.log(`\n🔄 LP Tokens Redeemed: ${lpAmount.toFixed(6)}`);
      console.log("\n===============================");
      
      // Wait for a moment to ensure the ledger finalizes
      console.log("⏳ Waiting for ledger to finalize...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Refresh the AMM data after the operation completes
      console.log("🔄 Updating AMM data from ledger...");
      try {
        // Get the updated AMM data
        const updatedAmmData = await getAmmInfo(ammAccount);
        
        if (updatedAmmData) {
          // Log updated pool balances
          console.log("\n=== Updated AMM Pool State ===");
          console.log(`Asset A (${updatedAmmData.amount.currency}): ${updatedAmmData.amount.value}`);
          console.log(`Asset B (${updatedAmmData.amount2.currency}): ${updatedAmmData.amount2.value}`);
          console.log(`LP tokens: ${updatedAmmData.lp_token.value}`);
          console.log("===========================\n");
        } else {
          console.log("⚠️ Could not retrieve updated AMM data");
        }
      } catch (updateError) {
        console.warn("⚠️ Error refreshing AMM data:", updateError.message);
      }
      
      // If this was done for an operational wallet, return info about the operational wallet
      const operationalInfo = operationalWalletInfo ? 
        { operationalWallet: operationalWalletInfo.classicAddress, destTag: operationalWalletInfo.destTag } : null;
      
      // Return success information
      return {
        success: true,
        withdrawnAmount: {
          [assetA.currency]: actualWithdrawnA ? actualWithdrawnA.value : expectedA.toFixed(6),
          [assetB.currency]: actualWithdrawnB ? actualWithdrawnB.value : expectedB.toFixed(6)
        },
        lpTokensRedeemed: lpAmount.toFixed(6),
        tx_hash: response.result.hash,
        tx_result: response.result.meta.TransactionResult,
        operationalInfo
      };
    } else {
      console.error(`❌ LP token withdrawal failed: ${response.result.meta.TransactionResult}`);
      return false;
    }
  } catch (error) {
    console.error("❌ Error withdrawing with LP token:", error.message);
    return false;
  }
};

// Withdraw all LP tokens at once
// The standby wallet performs the withdrawal on behalf of an operational wallet
export async function withdrawAllLiquidity (standbyWallet, ammAccount, operationalWalletInfo = null) {
  try {
    await connectXrplClient();
    // Fix: Pass ammAccount as the first parameter to query by AMM account directly
    const ammData = await getAmmInfo(ammAccount);
    if (!ammData) {
      console.error(`❌ Error: AMM data not found for account ${ammAccount}`);
      return false;
    }
    
    // Verify that amount and amount2 exist in the AMM data
    if (!ammData.amount || !ammData.amount2) {
      console.error(`❌ Error: Invalid AMM data structure - missing asset information`);
      console.log("AMM Data received:", JSON.stringify(ammData, null, 2));
      return false;
    }
    
    const assetA = ammData.amount;
    const assetB = ammData.amount2;
    const lpToken = ammData.lp_token;
    
    // Log action differently depending on whether this is for an operational wallet or not
    if (operationalWalletInfo) {
      console.log(`✅ Withdrawing ALL liquidity from AMM at ${ammAccount} on behalf of operational wallet ${operationalWalletInfo.classicAddress}`);
    } else {
      console.log(`✅ Withdrawing ALL liquidity from AMM at ${ammAccount}`);
    }
    
    // Get LP token balance for the standby wallet
    const accountLinesResponse = await client.request({
      command: "account_lines",
      account: standbyWallet.classicAddress,
      peer: lpToken.issuer
    });
    
    const trustlines = accountLinesResponse.result.lines;
    const lpTrustline = trustlines.find(line => line.currency === lpToken.currency);
    
    if (!lpTrustline || new BigNumber(lpTrustline.balance).isZero()) {
      console.log("❌ No LP tokens found in standby wallet. Nothing to withdraw.");
      return false;
    }
    
    const lpBalance = new BigNumber(lpTrustline.balance).decimalPlaces(6, BigNumber.ROUND_DOWN);
    console.log(`🔹 Found ${lpBalance.toFixed(6)} LP tokens to withdraw`);
    
    // Add debugging
    console.log("📊 AMM Data:", JSON.stringify(ammData, null, 2));
    console.log("🔍 Asset A:", JSON.stringify(assetA, null, 2));
    console.log("🔍 Asset B:", JSON.stringify(assetB, null, 2));
    
    // Create assets with special handling for XRP
    let assetObjA, assetObjB;
    
    // Handle Asset A
    if (assetA.currency === "XRP") {
      assetObjA = "XRP";
    } else {
      assetObjA = {
        currency: assetA.currency,
        issuer: assetA.issuer
      };
    }
    
    // Handle Asset B
    if (assetB.currency === "XRP") {
      assetObjB = "XRP";
    } else {
      assetObjB = {
        currency: assetB.currency,
        issuer: assetB.issuer
      };
    }
    
    // Add debugging
    console.log("🔍 Asset Object A:", JSON.stringify(assetObjA, null, 2));
    console.log("🔍 Asset Object B:", JSON.stringify(assetObjB, null, 2));
    
    const ammWithdrawTx = {
      TransactionType: "AMMWithdraw",
      Account: standbyWallet.classicAddress,
      Asset: typeof assetA === 'string' ? { currency: "XRP" } : 
             (assetA.currency === "XRP" ? { currency: "XRP" } : 
             { currency: assetA.currency, issuer: assetA.issuer }),
      Asset2: typeof assetB === 'string' ? { currency: "XRP" } : 
              (assetB.currency === "XRP" ? { currency: "XRP" } : 
              { currency: assetB.currency, issuer: assetB.issuer }),
      // Use the tfWithdrawAll flag (0x00020000 = 131072)
      Flags: 131072,
      AMMAccount: ammAccount
    };
    
    // Add debugging for final transaction
    console.log("🔍 Final Asset:", JSON.stringify(ammWithdrawTx.Asset, null, 2));
    console.log("🔍 Final Asset2:", JSON.stringify(ammWithdrawTx.Asset2, null, 2));
    
    // If this is for an operational wallet, add destination tag
    if (operationalWalletInfo && operationalWalletInfo.destTag) {
      ammWithdrawTx.DestinationTag = operationalWalletInfo.destTag;
    }
    
    console.log("📜 Preparing Withdraw All AMMWithdraw transaction...");
    console.log("Transaction:", JSON.stringify(ammWithdrawTx, null, 4));
    
    const preparedTx = await client.autofill(ammWithdrawTx);
    
    // Set LastLedgerSequence
    const ledgerResponse = await client.request({ command: "ledger_current" });
    const currentLedger = ledgerResponse.result.ledger_current_index;
    preparedTx.LastLedgerSequence = currentLedger + 50;
    
    const signedTx = standbyWallet.sign(preparedTx);
    console.log("🚀 Submitting withdraw all transaction...");
    const response = await client.submitAndWait(signedTx.tx_blob);
    
    if (response.result.meta.TransactionResult === "tesSUCCESS") {
      console.log(`✅ Withdraw all successful!`);
      
      // Store initial pool values for logging
      const initialPoolA = new BigNumber(assetA.value);
      const initialPoolB = new BigNumber(assetB.value);
      
      // Extract the actual amounts withdrawn from the transaction metadata
      const nodes = response.result.meta.AffectedNodes;
      let actualWithdrawnA = null;
      let actualWithdrawnB = null;
      
      // Find the RippleState nodes that reflect the change in balances for tokens
      // and AccountRoot changes for XRP
      for (const node of nodes) {
        // Check for token changes (RippleState)
        if (node.ModifiedNode && node.ModifiedNode.LedgerEntryType === "RippleState") {
          const state = node.ModifiedNode;
          if (state.FinalFields && state.PreviousFields && 
              state.FinalFields.Balance && state.PreviousFields.Balance) {
            
            // Check for Asset A (if it's a token)
            if (!actualWithdrawnA && state.FinalFields.Balance.currency === (typeof assetA === 'object' ? assetA.currency : null)) {
              // Calculate the change in balance
              const prevBalance = parseFloat(state.PreviousFields.Balance.value);
              const finalBalance = parseFloat(state.FinalFields.Balance.value);
              
              // If the balance decreased (became more negative), that's what was withdrawn
              const diff = Math.abs(finalBalance - prevBalance);
              if (diff > 0) {
                actualWithdrawnA = {
                  currency: state.FinalFields.Balance.currency,
                  value: diff.toFixed(6)
                };
              }
            }
            
            // Check for Asset B (if it's a token)
            if (!actualWithdrawnB && state.FinalFields.Balance.currency === (typeof assetB === 'object' ? assetB.currency : null)) {
              // Calculate the change in balance
              const prevBalance = parseFloat(state.PreviousFields.Balance.value);
              const finalBalance = parseFloat(state.FinalFields.Balance.value);
              
              // If the balance decreased (became more negative), that's what was withdrawn
              const diff = Math.abs(finalBalance - prevBalance);
              if (diff > 0) {
                actualWithdrawnB = {
                  currency: state.FinalFields.Balance.currency,
                  value: diff.toFixed(6)
                };
              }
            }
          }
        }
        
        // Check for XRP changes (AccountRoot)
        else if (node.ModifiedNode && node.ModifiedNode.LedgerEntryType === "AccountRoot") {
          const state = node.ModifiedNode;
          if (state.FinalFields && state.PreviousFields && 
              state.FinalFields.Account === standbyWallet.classicAddress) {
              
            // Check if this is the wallet's XRP balance change
            if (state.FinalFields.Balance && state.PreviousFields.Balance) {
              const prevBalance = new BigNumber(state.PreviousFields.Balance);
              const finalBalance = new BigNumber(state.FinalFields.Balance);
              
              // If the balance increased, that's XRP being withdrawn from AMM
              if (finalBalance.isGreaterThan(prevBalance)) {
                const xrpDiff = finalBalance.minus(prevBalance);
                const xrpAmount = xrpDiff.dividedBy(1000000).toFixed(6); // Convert drops to XRP
                
                // Check if this is Asset A or Asset B
                if ((typeof assetA === 'string' || (typeof assetA === 'object' && assetA.currency === "XRP")) && !actualWithdrawnA) {
                  actualWithdrawnA = {
                    currency: "XRP",
                    value: xrpAmount
                  };
                } else if ((typeof assetB === 'string' || (typeof assetB === 'object' && assetB.currency === "XRP")) && !actualWithdrawnB) {
                  actualWithdrawnB = {
                    currency: "XRP",
                    value: xrpAmount
                  };
                }
              }
            }
          }
        }
      }
      
      console.log("\n===== Transaction Summary =====");
      console.log(`🔹 Transaction Hash: ${response.result.hash}`);
      
      console.log(`\n📤 Withdrawn Amounts:`);
      if (actualWithdrawnA) {
        console.log(`   ${actualWithdrawnA.value} ${actualWithdrawnA.currency}`);
      } else {
        // For XRP, convert drops to XRP by dividing by 1000000
        if (typeof assetA === 'string' || assetA.currency === "XRP") {
          const xrpAmount = new BigNumber(typeof assetA === 'string' ? assetA : assetA.value).dividedBy(1000000).toFixed(6);
          console.log(`   ~${xrpAmount} XRP (estimated)`);
        } else {
          console.log(`   ~${initialPoolA.toFixed(6)} ${assetA.currency} (estimated)`);
        }
      }
      
      if (actualWithdrawnB) {
        console.log(`   ${actualWithdrawnB.value} ${actualWithdrawnB.currency}`);
      } else {
        // For XRP, convert drops to XRP by dividing by 1000000
        if (typeof assetB === 'string' || assetB.currency === "XRP") {
          const xrpAmount = new BigNumber(typeof assetB === 'string' ? assetB : assetB.value).dividedBy(1000000).toFixed(6);
          console.log(`   ~${xrpAmount} XRP (estimated)`);
        } else {
          console.log(`   ~${initialPoolB.toFixed(6)} ${assetB.currency} (estimated)`);
        }
      }
      
      console.log(`\n🔄 All LP tokens redeemed`);
      console.log("\n===============================");
      
      // Wait for a moment to ensure the ledger finalizes
      console.log("⏳ Waiting for ledger to finalize...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // If this was done for an operational wallet, return info about the operational wallet
      const operationalInfo = operationalWalletInfo ? 
        { operationalWallet: operationalWalletInfo.classicAddress, destTag: operationalWalletInfo.destTag } : null;
      
      // Determine proper currency strings for return values
      const currencyA = typeof assetA === 'string' ? "XRP" : assetA.currency;
      const currencyB = typeof assetB === 'string' ? "XRP" : assetB.currency;
      
      return {
        success: true,
        withdrawnAmountA: actualWithdrawnA ? actualWithdrawnA.value : initialPoolA.toFixed(6),
        withdrawnAmountB: actualWithdrawnB ? actualWithdrawnB.value : initialPoolB.toFixed(6),
        currencyA: currencyA,
        currencyB: currencyB,
        tx_hash: response.result.hash,
        tx_result: response.result.meta.TransactionResult,
        operationalInfo
      };
    } else {
      throw new Error(`AMM withdrawal failed: ${response.result.meta.TransactionResult}`);
    }
  } catch (error) {
    console.error("❌ Error withdrawing all liquidity:", error.message);
    throw error;
  }
};

// Single asset withdrawal - withdraw just one asset
// The standby wallet performs the withdrawal on behalf of an operational wallet
export async function withdrawSingleAsset (standbyWallet, ammAccount, assetType, withdrawAmount, operationalWalletInfo = null) {
  try {
    await connectXrplClient();
    // Fix: Pass ammAccount as the first parameter to query by AMM account directly
    const ammData = await getAmmInfo(ammAccount);
    if (!ammData) {
      console.error(`❌ Error: AMM data not found for account ${ammAccount}`);
      return false;
    }
    
    // Verify that amount and amount2 exist in the AMM data
    if (!ammData.amount || !ammData.amount2) {
      console.error(`❌ Error: Invalid AMM data structure - missing asset information`);
      console.log("AMM Data received:", JSON.stringify(ammData, null, 2));
      return false;
    }
    
    const asset = assetType === 'A' ? ammData.amount : ammData.amount2;
    const otherAsset = assetType === 'A' ? ammData.amount2 : ammData.amount;
    const lpToken = ammData.lp_token;
    
    // Store original input amount for return values
    const originalAmount = withdrawAmount;
    
    // Get the currency for logging
    const assetCurrency = typeof asset === 'string' ? 'XRP' : asset.currency;
    
    // Log action differently depending on whether this is for an operational wallet or not
    if (operationalWalletInfo) {
      console.log(`✅ Withdrawing ${withdrawAmount} ${assetCurrency} from AMM at ${ammAccount} on behalf of operational wallet ${operationalWalletInfo.classicAddress}`);
    } else {
      console.log(`✅ Withdrawing ${withdrawAmount} ${assetCurrency} from AMM at ${ammAccount}`);
    }
    
    // Get LP token balance for the standby wallet
    const accountLinesResponse = await client.request({
      command: "account_lines",
      account: standbyWallet.classicAddress,
      peer: lpToken.issuer
    });
    
    const trustlines = accountLinesResponse.result.lines;
    const lpTrustline = trustlines.find(line => line.currency === lpToken.currency);
    
    if (!lpTrustline || new BigNumber(lpTrustline.balance).isZero()) {
      console.log("❌ No LP tokens found in standby wallet. Nothing to withdraw.");
      return false;
    }
    
    const lpBalance = new BigNumber(lpTrustline.balance).decimalPlaces(6, BigNumber.ROUND_DOWN);
    console.log(`✅ Standby wallet LP token balance: ${lpBalance.toFixed(6)}`);
    
    // Show current AMM pool state
    console.log(`\n📊 Current AMM Pool State:`);
    
    // Get currency names properly - handle both XRP (string) and tokens (objects)
    let selectedAssetCurrency, otherAssetCurrency;
    if (typeof asset === 'string') {
      selectedAssetCurrency = 'XRP';
    } else {
      selectedAssetCurrency = asset.currency;
    }
    
    if (typeof otherAsset === 'string') {
      otherAssetCurrency = 'XRP';
    } else {
      otherAssetCurrency = otherAsset.currency;
    }
    
    console.log(`   ${selectedAssetCurrency}: ${typeof asset === 'string' ? xrpl.dropsToXrp(asset) : asset.value}`);
    console.log(`   ${otherAssetCurrency}: ${typeof otherAsset === 'string' ? xrpl.dropsToXrp(otherAsset) : otherAsset.value}`);
    console.log(`   LP Tokens: ${ammData.lp_token.value}`);
    
    // Convert to BigNumber with 6 decimals precision
    const totalPool = new BigNumber(assetType === 'A' ? ammData.amount.value : ammData.amount2.value);
    const totalLP = new BigNumber(lpToken.value);
    const withdrawAmount_BN = new BigNumber(withdrawAmount).decimalPlaces(6, BigNumber.ROUND_DOWN);
    
    // Calculate required LP tokens (estimation)
    const requiredLP = withdrawAmount_BN.multipliedBy(totalLP).dividedBy(totalPool)
      .multipliedBy(1.02) // Add 2% to account for price limit constraints
      .decimalPlaces(6, BigNumber.ROUND_DOWN);
      
    console.log(`🔹 Estimated LP tokens required: ${requiredLP.toFixed(6)}`);
    
    // Create assets with special handling for XRP
    let assetObj, otherAssetObj, amountObj;
    
    // Handle primary asset (the one being withdrawn)
    if (typeof asset === 'string' || asset.currency === "XRP") {
      assetObj = { currency: "XRP" };
      // Convert XRP to drops for the blockchain transaction
      amountObj = xrpl.xrpToDrops(withdrawAmount_BN.toFixed(6));
      console.log(`🔹 Converting ${withdrawAmount_BN.toFixed(6)} XRP to ${amountObj} drops for blockchain transaction`);
    } else {
      assetObj = {
        currency: asset.currency,
        issuer: asset.issuer
      };
      amountObj = {
        currency: asset.currency,
        issuer: asset.issuer,
        value: withdrawAmount_BN.toFixed(6)
      };
    }
    
    // Handle other asset
    if (typeof otherAsset === 'string' || otherAsset.currency === "XRP") {
      otherAssetObj = { currency: "XRP" };
    } else {
      otherAssetObj = {
        currency: otherAsset.currency,
        issuer: otherAsset.issuer
      };
    }
    
    const ammWithdrawTx = {
      TransactionType: "AMMWithdraw",
      Account: standbyWallet.classicAddress,
      Asset: assetObj,
      Asset2: otherAssetObj,
      Amount: amountObj,
      // Use tfSingleAsset (0x00080000)
      Flags: 0x00080000
    };
    
    // Add AMMAccount if available
    if (ammAccount) {
      ammWithdrawTx.AMMAccount = ammAccount;
    }
    
    // If this is for an operational wallet, add destination tag
    if (operationalWalletInfo && operationalWalletInfo.destTag) {
      ammWithdrawTx.DestinationTag = operationalWalletInfo.destTag;
    }
    
    console.log("📜 Preparing Single Asset AMMWithdraw transaction...");
    console.log("Transaction:", JSON.stringify(ammWithdrawTx, null, 4));
    
    const preparedTx = await client.autofill(ammWithdrawTx);
    
    // Set LastLedgerSequence to ensure transaction doesn't hang
    const ledgerResponse = await client.request({ command: "ledger_current" });
    const currentLedger = ledgerResponse.result.ledger_current_index;
    preparedTx.LastLedgerSequence = currentLedger + 50;
    
    const signedTx = standbyWallet.sign(preparedTx);
    console.log("🚀 Submitting single asset withdrawal...");
    const response = await client.submitAndWait(signedTx.tx_blob);
    
    if (response.result.meta.TransactionResult === "tesSUCCESS") {
      console.log("✅ Single asset withdrawal successful!");
      
      // Extract the actual amount withdrawn from the transaction metadata
      const nodes = response.result.meta.AffectedNodes;
      let actualWithdrawn = null;
      
      // Find the RippleState node that reflects the change in the withdrawn currency balance
      for (const node of nodes) {
        if (node.ModifiedNode && node.ModifiedNode.LedgerEntryType === "RippleState") {
          const state = node.ModifiedNode;
          if (state.FinalFields && state.PreviousFields && 
              state.FinalFields.Balance && state.PreviousFields.Balance &&
              state.FinalFields.Balance.currency === asset.currency) {
            
            // Calculate the change in balance
            const prevBalance = parseFloat(state.PreviousFields.Balance.value);
            const finalBalance = parseFloat(state.FinalFields.Balance.value);
            
            // If the balance decreased (became more negative), that's what was withdrawn
            const diff = Math.abs(finalBalance - prevBalance);
            if (diff > 0) {
              actualWithdrawn = {
                currency: state.FinalFields.Balance.currency,
                value: diff.toFixed(6)
              };
              break;
            }
          }
        }
      }
      
      console.log("\n===== Transaction Summary =====");
      console.log(`🔹 Transaction Hash: ${response.result.hash}`);
      
      if (actualWithdrawn) {
        console.log(`\n📤 Actual amount withdrawn:`);
        console.log(`   ${actualWithdrawn.value} ${actualWithdrawn.currency}`);
        console.log(`   (You requested: ${withdrawAmount} ${asset.currency})`);
      } else {
        console.log(`\n⚠️ Could not determine exact amount withdrawn from transaction metadata`);
        console.log(`   Requested: ${withdrawAmount} ${asset.currency}`);
      }
      console.log("\n===============================");
      
      // Wait for a moment to ensure the ledger finalizes
      console.log("⏳ Waiting for ledger to finalize...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // If this was done for an operational wallet, return info about the operational wallet
      const operationalInfo = operationalWalletInfo ? 
        { operationalWallet: operationalWalletInfo.classicAddress, destTag: operationalWalletInfo.destTag } : null;
      
      return {
        success: true,
        receivedAmount: actualWithdrawn ? actualWithdrawn.value : withdrawAmount.toFixed(6),
        currency: asset.currency,
        issuer: asset.issuer || null,  // null for XRP
        tx_hash: response.result.hash,
        tx_result: response.result.meta.TransactionResult,
        operationalInfo
      };
    } else {
      throw new Error(`AMM withdrawal failed: ${response.result.meta.TransactionResult}`);
    }
  } catch (error) {
    console.error("❌ Error withdrawing single asset:", error.message);
    throw error;
  }
};

// Single asset withdraw all - withdraw one asset by redeeming all LP tokens
// The standby wallet performs the withdrawal on behalf of an operational wallet
export async function withdrawAllSingleAsset (standbyWallet, ammAccount, assetType, desiredAmount, operationalWalletInfo = null) {
  try {
    await connectXrplClient();
    // Fix: Pass ammAccount as the first parameter to query by AMM account directly
    const ammData = await getAmmInfo(ammAccount);
    if (!ammData) {
      console.error(`❌ Error: AMM data not found for account ${ammAccount}`);
      return false;
    }
    
    // Verify that amount and amount2 exist in the AMM data
    if (!ammData.amount || !ammData.amount2) {
      console.error(`❌ Error: Invalid AMM data structure - missing asset information`);
      console.log("AMM Data received:", JSON.stringify(ammData, null, 2));
      return false;
    }
    
    const asset = assetType === 'A' ? ammData.amount : ammData.amount2;
    const otherAsset = assetType === 'A' ? ammData.amount2 : ammData.amount;
    const lpToken = ammData.lp_token;
    
    // Log action differently depending on whether this is for an operational wallet or not
    if (operationalWalletInfo) {
      console.log(`✅ Withdrawing all of ${asset.currency} from AMM at ${ammAccount} on behalf of operational wallet ${operationalWalletInfo.classicAddress}`);
    } else {
      console.log(`✅ Withdrawing all of ${asset.currency} from AMM at ${ammAccount}`);
    }

    // Convert desired amount to BigNumber with 6 decimals precision
    // If desiredAmount is null, this is a true withdraw-all operation
    let amount_BN, withdrawObj;
    
    if (desiredAmount === null) {
      // True withdraw-all - set amount to 0 as per XRPL docs
      console.log(`--- True Withdraw All Information ---`);
      console.log(`Asset to withdraw: ${asset.currency}`);
      console.log(`Operation: Withdraw ALL LP tokens for maximum ${asset.currency}`);
      console.log(`\nℹ️ Note: Withdraw All will redeem ALL your LP tokens for the maximum available amount of ${asset.currency}.`);
      console.log(`   Setting Amount to 0 as per XRPL protocol requirements.`);
      
      // For true withdraw-all, set amount to 0 (minimum to succeed)
      if (asset.currency === "XRP") {
        withdrawObj = "0";  // 0 drops for XRP
      } else {
        withdrawObj = {
          currency: asset.currency,
          issuer: asset.issuer,
          value: "0"
        };
      }
      amount_BN = new BigNumber("0");
    } else {
      // Legacy mode with specified amount
      amount_BN = new BigNumber(desiredAmount).decimalPlaces(6, BigNumber.ROUND_DOWN);

      // Check for sane minimum
      const minAmount = new BigNumber("0.000001");
      if (amount_BN.lt(minAmount)) {
        console.log(`❌ Warning: Minimum amount is too small. Using ${minAmount.toFixed(6)} instead.`);
        amount_BN = minAmount;
      }
      
      // Create withdrawal object
      if (asset.currency === "XRP") {
        withdrawObj = xrpl.xrpToDrops(amount_BN.toFixed(6));
      } else {
        withdrawObj = {
          currency: asset.currency,
          issuer: asset.issuer,
          value: amount_BN.toFixed(6)
        };
      }
      
      console.log(`--- Withdrawal Information ---`);
      console.log(`Asset to withdraw: ${asset.currency}`);
      console.log(`Requested amount: ${desiredAmount} ${asset.currency}`);
      console.log(`\nℹ️ Note: Withdraw All will redeem ALL your LP tokens for the maximum available amount of ${asset.currency}.`);
      console.log(`   The requested amount is used as a minimum threshold, but you may receive more.`);
      console.log(`   This is particularly useful when you want to exit a position entirely.`);
    }
    
    // Create asset objects with special handling for XRP
    // Both Asset and Asset2 are required to identify the AMM pool, even for single asset withdrawals
    let assetObj, otherAssetObj;
    
    if (asset.currency === "XRP") {
      assetObj = { currency: "XRP" };
    } else {
      assetObj = {
        currency: asset.currency,
        issuer: asset.issuer
      };
    }
    
    // Handle other asset (also required to identify the AMM pool)
    if (otherAsset.currency === "XRP") {
      otherAssetObj = { currency: "XRP" };
    } else {
      otherAssetObj = {
        currency: otherAsset.currency,
        issuer: otherAsset.issuer
      };
    }
    
    // DEBUG: Log the asset objects to see what we have
    console.log("🔍 DEBUG - Asset objects created:");
    console.log("   assetObj:", JSON.stringify(assetObj, null, 2));
    console.log("   otherAssetObj:", JSON.stringify(otherAssetObj, null, 2));
    console.log("   asset.currency:", asset.currency);
    console.log("   otherAsset.currency:", otherAsset.currency);
    
    // Build the AMMWithdraw transaction
    // Both Asset and Asset2 are required to identify the AMM pool
    const ammWithdrawTx = {
      TransactionType: "AMMWithdraw",
      Account: standbyWallet.classicAddress,
      Asset: assetObj,  // The asset we want to withdraw
      Asset2: otherAssetObj,  // The other asset in the pool (required to identify AMM)
      Amount: withdrawObj,  // Always include Amount field (0 for true withdraw-all)
      // Use only tfOneAssetWithdrawAll (0x00040000 = 262144)
      Flags: 262144,
      AMMAccount: ammAccount
    };
    
    // If this is for an operational wallet, add destination tag
    if (operationalWalletInfo && operationalWalletInfo.destTag) {
      ammWithdrawTx.DestinationTag = operationalWalletInfo.destTag;
    }

    console.log("📜 Preparing Single Asset Withdraw All transaction...");
    console.log("Transaction BEFORE autofill:", JSON.stringify(ammWithdrawTx, null, 4));

    // Autofill the transaction (Fee, Sequence, etc.)
    const preparedTx = await client.autofill(ammWithdrawTx);
    
    // Set LastLedgerSequence to ensure transaction doesn't hang - increased buffer for timing
    const ledgerResponse = await client.request({ command: "ledger_current" });
    const currentLedger = ledgerResponse.result.ledger_current_index;
    preparedTx.LastLedgerSequence = currentLedger + 50;  // Increased from 10 to 50
    
    console.log("📜 Prepared transaction AFTER autofill:", JSON.stringify(preparedTx, null, 4));

    const signedTx = standbyWallet.sign(preparedTx);
    console.log("🚀 Submitting single asset withdraw all transaction...");
    const response = await client.submitAndWait(signedTx.tx_blob);
    console.log("Response:", JSON.stringify(response, null, 2));

    if (response.result.meta.TransactionResult === "tesSUCCESS") {
      console.log("✅ Single asset withdraw all successful!");

      // Wait briefly for ledger finalization
      console.log("⏳ Waiting for ledger to finalize...");
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Extract the actual amount withdrawn from the transaction metadata
      const nodes = response.result.meta.AffectedNodes;
      let actualWithdrawn = null;
      
      // Find the RippleState node that reflects the change in the withdrawn currency balance
      for (const node of nodes) {
        if (node.ModifiedNode && node.ModifiedNode.LedgerEntryType === "RippleState") {
          const state = node.ModifiedNode;
          if (state.FinalFields && state.PreviousFields && 
              state.FinalFields.Balance && state.PreviousFields.Balance &&
              state.FinalFields.Balance.currency === asset.currency) {
            
            // Calculate the change in balance
            const prevBalance = parseFloat(state.PreviousFields.Balance.value);
            const finalBalance = parseFloat(state.FinalFields.Balance.value);
            
            // If the balance decreased (became more negative), that's what was withdrawn
            const diff = Math.abs(finalBalance - prevBalance);
            if (diff > 0) {
              actualWithdrawn = {
                currency: state.FinalFields.Balance.currency,
                value: diff.toFixed(6)
              };
              break;
            }
          }
        }
      }
      
      console.log("\n===== Transaction Summary =====");
      console.log(`🔹 Transaction Hash: ${response.result.hash}`);
      
      if (actualWithdrawn) {
        console.log(`\n📤 Actual amount withdrawn:`);
        console.log(`   ${actualWithdrawn.value} ${actualWithdrawn.currency}`);
        if (desiredAmount) {
          console.log(`   (You requested: ${desiredAmount} ${asset.currency})`);
          
          if (parseFloat(actualWithdrawn.value) > parseFloat(desiredAmount)) {
            console.log(`\nℹ️ Note: You received more than requested because this was a withdraw-all operation`);
            console.log(`   which redeems all your LP tokens for the selected asset.`);
          }
        } else {
          console.log(`   (True withdraw-all operation - no minimum specified)`);
        }
      } else {
        console.log(`\n⚠️ Could not determine exact amount withdrawn from transaction metadata`);
        if (desiredAmount) {
          console.log(`   Requested: ${desiredAmount} ${asset.currency}`);
        } else {
          console.log(`   True withdraw-all operation completed`);
        }
      }
      console.log("\n===============================");
      
      // 5. Update AMM data
      console.log("⏳ Waiting for ledger to finalize...");
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // If this was done for an operational wallet, return info about the operational wallet
      const operationalInfo = operationalWalletInfo ? 
        { operationalWallet: operationalWalletInfo.classicAddress, destTag: operationalWalletInfo.destTag } : null;

      // Return more detailed information for operational wallet handling
      return {
        success: true,
        receivedAmount: actualWithdrawn ? actualWithdrawn.value : (desiredAmount ? desiredAmount.toFixed(6) : "0"),
        currency: asset.currency,
        issuer: asset.issuer || null,  // null for XRP
        minimumAmount: desiredAmount ? amount_BN.toFixed(6) : "0",
        tx_hash: response.result.hash,
        tx_result: response.result.meta.TransactionResult,
        operationalInfo
      };
    } else {
      throw new Error(`AMM withdrawal failed: ${response.result.meta.TransactionResult}`);
    }
  } catch (error) {
    console.error("❌ Error withdrawing all single asset:", error.message);
    throw error;
  }
};

// Single asset withdraw with LP token amount
// The standby wallet performs the withdrawal on behalf of an operational wallet
export async function withdrawSingleAssetWithLPToken (standbyWallet, ammAccount, assetType, lpTokenAmount, operationalWalletInfo = null) {
  try {
    await connectXrplClient();
    // Fix: Pass ammAccount as the first parameter to query by AMM account directly
    const ammData = await getAmmInfo(ammAccount);
    if (!ammData) {
      console.error(`❌ Error: AMM data not found for account ${ammAccount}`);
      return false;
    }
    
    // Verify that amount and amount2 exist in the AMM data
    if (!ammData.amount || !ammData.amount2) {
      console.error(`❌ Error: Invalid AMM data structure - missing asset information`);
      console.log("AMM Data received:", JSON.stringify(ammData, null, 2));
      return false;
    }
    
    const asset = assetType === 'A' ? ammData.amount : ammData.amount2;
    const otherAsset = assetType === 'A' ? ammData.amount2 : ammData.amount;
    const lpToken = ammData.lp_token;
    
    // Explicitly log which asset is being withdrawn for clarity
    console.log(`🔍 Asset to withdraw: ${asset.currency} (Asset ${assetType})`);
    console.log(`🔍 Other asset in pair: ${otherAsset.currency}`);
    
    // Log action differently depending on whether this is for an operational wallet or not
    if (operationalWalletInfo) {
      console.log(`✅ Withdrawing specific LP amount as single asset (${asset.currency}) on behalf of operational wallet ${operationalWalletInfo.classicAddress}`);
    } else {
      console.log(`✅ Withdrawing specific LP amount as single asset (${asset.currency})`);
    }
    
    // Convert to BigNumber with 6 decimals precision
    const lpAmount = new BigNumber(lpTokenAmount).decimalPlaces(6, BigNumber.ROUND_DOWN);
    
    // Calculate expected withdrawal amount (estimation)
    const totalPoolAsset = new BigNumber(assetType === 'A' ? ammData.amount.value : ammData.amount2.value);
    const totalLP = new BigNumber(lpToken.value);
    const expectedAmount = lpAmount.multipliedBy(totalPoolAsset).dividedBy(totalLP).decimalPlaces(6, BigNumber.ROUND_DOWN);
    
    // Create assets with special handling for XRP
    let assetObj, otherAssetObj, amountObj;
    
    // Handle primary asset (the one being withdrawn)
    if (asset.currency === "XRP") {
      assetObj = "XRP";
      amountObj = "0"; // Amount can be 0 when using tfOneAssetLPToken
    } else {
      assetObj = {
        currency: asset.currency,
        issuer: asset.issuer
      };
      amountObj = {
        currency: asset.currency,
        issuer: asset.issuer,
        value: "0" // Amount can be 0 when using tfOneAssetLPToken
      };
    }
    
    // Handle other asset
    if (otherAsset.currency === "XRP") {
      otherAssetObj = "XRP";
    } else {
      otherAssetObj = {
        currency: otherAsset.currency,
        issuer: otherAsset.issuer
      };
    }
    
    const ammWithdrawTx = {
      TransactionType: "AMMWithdraw",
      Account: standbyWallet.classicAddress,
      // Use the correct asset as the primary asset (the one we want to withdraw)
      Asset: asset.currency === "XRP" ? { currency: "XRP" } : assetObj,
      Asset2: otherAsset.currency === "XRP" ? { currency: "XRP" } : otherAssetObj,
      Amount: amountObj,
      LPTokenIn: {
        currency: lpToken.currency,
        issuer: lpToken.issuer,
        value: lpAmount.toFixed(6)
      },
      // Use tfOneAssetLPToken (0x00200000)
      Flags: 2097152,
      AMMAccount: ammAccount
    };
    
    // If this is for an operational wallet, add destination tag
    if (operationalWalletInfo && operationalWalletInfo.destTag) {
      ammWithdrawTx.DestinationTag = operationalWalletInfo.destTag;
    }
    
    console.log("📜 Preparing Single Asset LP Token withdrawal transaction...");
    console.log("Transaction:", JSON.stringify(ammWithdrawTx, null, 4));
    
    const preparedTx = await client.autofill(ammWithdrawTx);
    
    // Set LastLedgerSequence to ensure transaction doesn't hang
    const ledgerResponse = await client.request({ command: "ledger_current" });
    const currentLedger = ledgerResponse.result.ledger_current_index;
    preparedTx.LastLedgerSequence = currentLedger + 50;
    
    const signedTx = standbyWallet.sign(preparedTx);
    console.log("🚀 Submitting single asset LP token withdrawal...");
    const response = await client.submitAndWait(signedTx.tx_blob);
    
    if (response.result.meta.TransactionResult === "tesSUCCESS") {
      console.log("✅ Single asset withdraw with LP token successful!");
      
      // Extract the actual amount withdrawn from the transaction metadata
      const nodes = response.result.meta.AffectedNodes;
      let actualWithdrawn = null;
      
      // Find the RippleState node that shows the change in the wallet's balance for the withdrawn asset
      for (const node of nodes) {
        if (node.ModifiedNode && node.ModifiedNode.LedgerEntryType === "RippleState") {
          const state = node.ModifiedNode;
          if (state.FinalFields && state.PreviousFields && 
              state.FinalFields.Balance && state.PreviousFields.Balance &&
              typeof state.FinalFields.Balance === 'object' && 
              typeof state.PreviousFields.Balance === 'object') {
            
            // Check if this RippleState involves our wallet and the asset we're withdrawing
            const isOurWallet = (state.FinalFields.HighLimit && 
                               state.FinalFields.HighLimit.issuer === standbyWallet.classicAddress) ||
                              (state.FinalFields.LowLimit && 
                               state.FinalFields.LowLimit.issuer === standbyWallet.classicAddress);
            
            // Check if this is for the asset we're withdrawing
            const isCorrectAsset = state.FinalFields.Balance.currency === asset.currency;
            
            if (isOurWallet && isCorrectAsset) {
              // Calculate the change in balance (withdrawal increases the absolute value of negative balance)
              const prevBalance = parseFloat(state.PreviousFields.Balance.value);
              const finalBalance = parseFloat(state.FinalFields.Balance.value);
              
              // For withdrawals, the balance becomes more negative, so we calculate the absolute difference
              const diff = Math.abs(finalBalance - prevBalance);
              if (diff > 0) {
                actualWithdrawn = {
                  currency: state.FinalFields.Balance.currency,
                  value: diff.toFixed(6)
                };
                break;
              }
            }
          }
        }
      }
      
      console.log("\n===== Transaction Summary =====");
      console.log(`🔹 Transaction Hash: ${response.result.hash}`);
      
      if (actualWithdrawn) {
        console.log(`\n📤 Actual amount withdrawn:`);
        console.log(`   ${actualWithdrawn.value} ${actualWithdrawn.currency}`);
        console.log(`\n🔄 LP Tokens Used: ${lpTokenAmount}`);
        console.log(`\n📊 Expected amount: ${expectedAmount.toFixed(6)} ${asset.currency}`);
        const difference = Math.abs(parseFloat(actualWithdrawn.value) - parseFloat(expectedAmount.toFixed(6)));
        console.log(`📊 Difference from estimate: ${difference.toFixed(6)} ${asset.currency}`);
      } else {
        console.log(`\n⚠️ Could not determine exact amount withdrawn from transaction metadata`);
        console.log(`\n🔄 LP Tokens Used: ${lpTokenAmount}`);
        console.log(`\n📊 Expected amount: ${expectedAmount.toFixed(6)} ${asset.currency}`);
      }
      console.log("\n===============================");
      
      console.log("⏳ Waiting for ledger to finalize...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // If this was done for an operational wallet, return info about the operational wallet
      const operationalInfo = operationalWalletInfo ? 
        { operationalWallet: operationalWalletInfo.classicAddress, destTag: operationalWalletInfo.destTag } : null;

      // Return more detailed information for operational wallet handling
      return {
        success: true,
        receivedAmount: actualWithdrawn ? actualWithdrawn.value : expectedAmount.toFixed(6),
        currency: asset.currency,
        issuer: asset.issuer || null,  // null for XRP
        lpTokensUsed: lpTokenAmount,
        tx_hash: response.result.hash,
        tx_result: response.result.meta.TransactionResult,
        operationalInfo
      };
    } else {
      throw new Error(`AMM withdrawal failed: ${response.result.meta.TransactionResult}`);
    }
  } catch (error) {
    console.error("❌ Error withdrawing single asset with LP token:", error.message);
    throw error;
  }
};

