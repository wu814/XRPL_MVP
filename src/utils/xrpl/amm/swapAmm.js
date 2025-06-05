import { client, connectXrplClient } from "../testnet";
import * as xrpl from "xrpl";
import getAmmInfo from "./getAmmInfo";
const { findAmmPath } = require('../pathfindingController/pathfindingEngine');

/**
 * Swap assets in a specific AMM pool with cross-AMM rate checking
 * @param {object} wallet - The wallet performing the swap
 * @param {string} ammAccount - Specific AMM account to trade in  
 * @param {string} fromCurrency - Currency to sell
 * @param {string} toCurrency - Currency to buy
 * @param {string} fromAmount - Amount to sell
 * @param {string} issuerAddress - Issuer address for tokens
 * @param {number} slippagePercent - Slippage tolerance (default 3%)
 * @returns {Promise<object>} Swap result
 */
const swapInSpecificAMM = async (wallet, ammAccount, fromCurrency, toCurrency, fromAmount, issuerAddress, slippagePercent = 3) => {
  try {
    await connectXrplClient();
    
    console.log(`🔄 AMM Swap: ${fromAmount} ${fromCurrency} → ${toCurrency} in pool ${ammAccount}`);
    console.log(`⚡ Checking specific pool first, then comparing with other AMMs...`);
    
    // Step 1: Get the target AMM info
    const targetAmmInfo = await getAmmInfo(ammAccount);
    if (!targetAmmInfo) {
      throw new Error(`AMM not found: ${ammAccount}`);
    }
    
    // Step 2: Calculate rate in the target AMM
    const targetRate = calculateSwapRate(targetAmmInfo, fromCurrency, toCurrency, fromAmount);
    const targetOutput = parseFloat(fromAmount) * targetRate * (1 - 0.003); // 0.3% fee
    
    console.log(`🎯 Target AMM Rate: ${targetRate.toFixed(6)} (Est. output: ${targetOutput.toFixed(6)} ${toCurrency})`);
    
    // Step 3: Check other AMMs for better rates (pathfinding across all AMMs)
    console.log(`🔍 Checking all other AMMs for better rates...`);
    const pathfindingResult = await findAmmPath(fromCurrency, toCurrency, fromAmount, issuerAddress);
    
    let useTargetPool = true;
    let bestRate = targetRate;
    let bestOutput = targetOutput;
    
    if (pathfindingResult.success && pathfindingResult.bestPath) {
      const pathfindingRate = pathfindingResult.bestRate;
      const pathfindingOutput = parseFloat(pathfindingResult.bestPath.estimatedOutput);
      
      console.log(`🔍 Best Alternative Rate: ${pathfindingRate.toFixed(6)} (Est. output: ${pathfindingOutput.toFixed(6)} ${toCurrency})`);
      
      // Only switch if alternative is significantly better (> 1% improvement)
      const improvementThreshold = 1.01;
      if (pathfindingRate > targetRate * improvementThreshold) {
        console.log(`✨ Found better rate! Switching from target pool to ${pathfindingResult.bestPath.type}`);
        useTargetPool = false;
        bestRate = pathfindingRate;
        bestOutput = pathfindingOutput;
      } else {
        console.log(`✅ Target pool has competitive rate, proceeding with original plan`);
      }
    } else {
      console.log(`ℹ️ No alternative paths found, using target pool`);
    }
    
    // Step 4: Execute the swap
    if (useTargetPool) {
      return await executeAmmSwap(wallet, ammAccount, fromCurrency, toCurrency, fromAmount, issuerAddress, slippagePercent);
    } else {
      // Use cross-currency payment for multi-hop routing
      console.log(`🌐 Executing via cross-currency payment for optimal routing`);
      const { sendCrossCurrency } = require('../transactionController/sendCrossCurrency');
      return await sendCrossCurrency(
        wallet,
        wallet.classicAddress, // Self-send for conversion
        fromCurrency,
        fromAmount,
        toCurrency,
        issuerAddress,
        slippagePercent
      );
    }
    
  } catch (error) {
    console.error(`❌ AMM swap error: ${error.message}`);
    throw error;
  }
};

/**
 * Execute a direct swap in a specific AMM pool
 * @param {object} wallet - The wallet performing the swap
 * @param {string} ammAccount - AMM account
 * @param {string} fromCurrency - Currency to sell
 * @param {string} toCurrency - Currency to buy  
 * @param {string} fromAmount - Amount to sell
 * @param {string} issuerAddress - Issuer address for tokens
 * @param {number} slippagePercent - Slippage tolerance
 * @returns {Promise<object>} Swap result
 */
const executeAmmSwap = async (wallet, ammAccount, fromCurrency, toCurrency, fromAmount, issuerAddress, slippagePercent) => {
  try {
    // Get AMM info for assets
    const ammInfo = await getAmmInfo(ammAccount);
    
    // Prepare asset objects
    let assetIn, assetOut, amountIn;
    
    if (fromCurrency === "XRP") {
      assetIn = { currency: "XRP" };
      amountIn = xrpl.xrpToDrops(fromAmount);
    } else {
      assetIn = {
        currency: fromCurrency,
        issuer: issuerAddress
      };
      amountIn = {
        currency: fromCurrency,
        issuer: issuerAddress,
        value: fromAmount
      };
    }
    
    if (toCurrency === "XRP") {
      assetOut = { currency: "XRP" };
    } else {
      assetOut = {
        currency: toCurrency,
        issuer: issuerAddress
      };
    }
    
    // Calculate minimum amount out with slippage
    const rate = calculateSwapRate(ammInfo, fromCurrency, toCurrency, fromAmount);
    const expectedOut = parseFloat(fromAmount) * rate * (1 - 0.003); // Trading fee
    const minAmountOut = expectedOut * (1 - slippagePercent / 100);
    
    let amountOut;
    if (toCurrency === "XRP") {
      amountOut = xrpl.xrpToDrops(minAmountOut.toFixed(6));
    } else {
      amountOut = {
        currency: toCurrency,
        issuer: issuerAddress,
        value: minAmountOut.toFixed(6)
      };
    }
    
    // Create swap transaction
    const swapTx = {
      TransactionType: "AMMDeposit",
      Account: wallet.classicAddress,
      AMMAccount: ammAccount,
      Asset: assetIn,
      Asset2: assetOut,
      Amount: amountIn,
      Flags: 0x00001000000 // tfTwoAssetIfEmpty equivalent for swaps
    };
    
    console.log("📜 Prepared AMM Swap TX:", JSON.stringify(swapTx, null, 2));
    
    // Submit transaction
    const preparedTx = await client.autofill(swapTx);
    const signedTx = wallet.sign(preparedTx);
    
    console.log("🚀 Submitting AMM swap...");
    const response = await client.submitAndWait(signedTx.tx_blob);
    
    if (response.result.meta.TransactionResult === "tesSUCCESS") {
      console.log("✅ AMM swap successful!");
      
      // Parse results
      const actualOutput = parseActualSwapOutput(response, toCurrency);
      
      console.log(`💱 Swap Details:`);
      console.log(`   Sold: ${fromAmount} ${fromCurrency}`);
      console.log(`   Received: ${actualOutput} ${toCurrency}`);
      console.log(`   Effective Rate: ${(parseFloat(actualOutput) / parseFloat(fromAmount)).toFixed(6)}`);
      console.log(`   Transaction: ${response.result.hash}`);
      
      return {
        success: true,
        amountIn: fromAmount,
        amountOut: actualOutput,
        currencyIn: fromCurrency,
        currencyOut: toCurrency,
        effectiveRate: parseFloat(actualOutput) / parseFloat(fromAmount),
        txHash: response.result.hash,
        type: 'amm_swap'
      };
    } else {
      throw new Error(`AMM swap failed: ${response.result.meta.TransactionResult}`);
    }
    
  } catch (error) {
    console.error(`❌ AMM swap execution error: ${error.message}`);
    throw error;
  }
};

/**
 * Calculate swap rate for AMM pool
 * @param {object} ammInfo - AMM information
 * @param {string} fromCurrency - Input currency
 * @param {string} toCurrency - Output currency  
 * @param {string} fromAmount - Input amount
 * @returns {number} Exchange rate
 */
const calculateSwapRate = (ammInfo, fromCurrency, toCurrency, fromAmount) => {
  const currencyA = typeof ammInfo.amount === 'string' ? 'XRP' : ammInfo.amount.currency;
  const currencyB = typeof ammInfo.amount2 === 'string' ? 'XRP' : ammInfo.amount2.currency;
  
  let reserveFrom, reserveTo;
  
  if (currencyA === fromCurrency && currencyB === toCurrency) {
    reserveFrom = typeof ammInfo.amount === 'string' ? 
      parseFloat(xrpl.dropsToXrp(ammInfo.amount)) : 
      parseFloat(ammInfo.amount.value);
    reserveTo = typeof ammInfo.amount2 === 'string' ? 
      parseFloat(xrpl.dropsToXrp(ammInfo.amount2)) : 
      parseFloat(ammInfo.amount2.value);
  } else if (currencyA === toCurrency && currencyB === fromCurrency) {
    reserveFrom = typeof ammInfo.amount2 === 'string' ? 
      parseFloat(xrpl.dropsToXrp(ammInfo.amount2)) : 
      parseFloat(ammInfo.amount2.value);
    reserveTo = typeof ammInfo.amount === 'string' ? 
      parseFloat(xrpl.dropsToXrp(ammInfo.amount)) : 
      parseFloat(ammInfo.amount.value);
  } else {
    return 0; // No direct conversion
  }
  
  if (reserveFrom > 0 && reserveTo > 0) {
    // Use constant product formula: (x * y = k)
    // After swap: (x + dx) * (y - dy) = k
    // So: dy = y * dx / (x + dx)
    const dx = parseFloat(fromAmount);
    const dy = (reserveTo * dx) / (reserveFrom + dx);
    return dy / dx;
  }
  
  return 0;
};

/**
 * Parse actual swap output from transaction metadata
 * @param {object} response - Transaction response
 * @param {string} outputCurrency - Expected output currency
 * @returns {string} Actual output amount
 */
const parseActualSwapOutput = (response, outputCurrency) => {
  try {
    // Look through affected nodes for balance changes
    const affectedNodes = response.result.meta.AffectedNodes;
    
    for (const node of affectedNodes) {
      if (node.ModifiedNode && node.ModifiedNode.LedgerEntryType === "AccountRoot") {
        // XRP balance change
        const finalFields = node.ModifiedNode.FinalFields;
        const previousFields = node.ModifiedNode.PreviousFields;
        
        if (outputCurrency === "XRP" && finalFields?.Balance && previousFields?.Balance) {
          const diff = parseFloat(xrpl.dropsToXrp(finalFields.Balance)) - 
                      parseFloat(xrpl.dropsToXrp(previousFields.Balance));
          if (diff > 0) {
            return Math.abs(diff).toFixed(6);
          }
        }
      } else if (node.ModifiedNode && node.ModifiedNode.LedgerEntryType === "RippleState") {
        // Token balance change
        const finalFields = node.ModifiedNode.FinalFields;
        const previousFields = node.ModifiedNode.PreviousFields;
        
        if (finalFields?.Balance?.currency === outputCurrency && 
            previousFields?.Balance?.currency === outputCurrency) {
          const diff = parseFloat(finalFields.Balance.value) - 
                      parseFloat(previousFields.Balance.value);
          if (Math.abs(diff) > 0) {
            return Math.abs(diff).toFixed(6);
          }
        }
      }
    }
    
    return "0"; // Fallback
  } catch (error) {
    console.error(`Error parsing swap output: ${error.message}`);
    return "0";
  }
};

module.exports = {
  swapInSpecificAMM,
  executeAmmSwap,
  calculateSwapRate
}; 