/**
 * Client-safe AMM calculation utilities
 * No server-side imports - safe for client components
 */

// Import BigNumber for precise decimal calculations
import BigNumber from 'bignumber.js';

/**
 * Calculate exact AMM input needed for a specific output using constant product formula
 * @param {number} poolX - Input asset pool balance
 * @param {number} poolY - Output asset pool balance  
 * @param {number} desiredOutput - Desired output amount
 * @param {number} slippageTolerance - Slippage tolerance (default 0.01 = 1%)
 * @param {number} tradingFeeUnits - Trading fee in XRPL units (1 unit = 0.001%, max 1000 = 1%)
 * @returns {Object} Calculation result with exact input needed
 */
export function calculateExactAMMInput(poolX, poolY, desiredOutput, slippageTolerance = 0, tradingFeeUnits = 0) {
  try {
    console.log(`🧮 AMM Constant Product Calculation (High Precision):`);
    console.log(`   Initial Pool: ${poolX} (input) / ${poolY} (output)`);
    console.log(`   Desired Output: ${desiredOutput}`);
    console.log(`   Trading Fee: ${tradingFeeUnits} XRPL fee units (${(tradingFeeUnits/1000).toFixed(3)}%)`);
    
    // Use BigNumber for precise calculations
    const poolXBN = new BigNumber(poolX);
    const poolYBN = new BigNumber(poolY);
    const desiredOutputBN = new BigNumber(desiredOutput);
    const slippageToleranceBN = new BigNumber(slippageTolerance);
    
    console.log(`   Constant k = ${poolXBN.multipliedBy(poolYBN).toFixed()}`);
    
    // Convert XRPL trading fee units to decimal with high precision
    // Per XRPL docs: fee units are in 1/100,000; value of 1 = 0.001%, max 1000 = 1%
    const tradingFeeDecimalBN = new BigNumber(tradingFeeUnits).dividedBy(100000);
    
    // If there's a trading fee, we need to account for it in our calculation
    let adjustedDesiredOutputBN = desiredOutputBN;
    
    if (tradingFeeUnits > 0) {
      // Calculate how much extra we need to request to account for the fee
      // If fee is 1% and we want 100, we need to request ~101.01 so that after 1% fee we get 100
      const oneMinusFee = new BigNumber(1).minus(tradingFeeDecimalBN);
      adjustedDesiredOutputBN = desiredOutputBN.dividedBy(oneMinusFee);
      console.log(`   Fee Adjustment: Requesting ${adjustedDesiredOutputBN.toFixed(6)} to get ${desiredOutput} after ${tradingFeeUnits} fee units`);
    }
    
    // Constant product formula: X * Y = k
    const k = poolXBN.multipliedBy(poolYBN);
    
    // After taking adjustedDesiredOutput from poolY:
    // newPoolY = poolY - adjustedDesiredOutput
    const newPoolYBN = poolYBN.minus(adjustedDesiredOutputBN);
    
    if (newPoolYBN.lte(0)) {
      throw new Error(`Insufficient liquidity: Cannot withdraw ${adjustedDesiredOutputBN.toFixed(6)} from pool of ${poolY}`);
    }
    
    // Calculate newPoolX using k = newPoolX * newPoolY
    // newPoolX = k / newPoolY
    const newPoolXBN = k.dividedBy(newPoolYBN);
    
    // Input needed = newPoolX - poolX
    const exactInputNeededBN = newPoolXBN.minus(poolXBN);
    
    // Apply slippage tolerance
    const inputWithSlippageBN = exactInputNeededBN.multipliedBy(new BigNumber(1).plus(slippageToleranceBN));
    
    console.log(`   After withdrawal: ${newPoolXBN.toFixed(6)} / ${newPoolYBN.toFixed(6)}`);
    console.log(`   Exact input needed: ${exactInputNeededBN.toFixed(6)}`);
    console.log(`   With ${slippageTolerance * 100}% slippage: ${inputWithSlippageBN.toFixed(6)}`);
    console.log(`   Price per unit: ${exactInputNeededBN.dividedBy(desiredOutputBN).toFixed(6)}`);
    
    return {
      success: true,
      exactInput: exactInputNeededBN.toNumber(),
      inputWithSlippage: inputWithSlippageBN.toNumber(),
      pricePerUnit: exactInputNeededBN.dividedBy(desiredOutputBN).toNumber(),
      newPoolX: newPoolXBN.toNumber(),
      newPoolY: newPoolYBN.toNumber(),
      slippageAmount: inputWithSlippageBN.minus(exactInputNeededBN).toNumber(),
      tradingFeeAdjustment: adjustedDesiredOutputBN.minus(desiredOutputBN).toNumber(),
      adjustedOutput: adjustedDesiredOutputBN.toNumber()
    };
    
  } catch (error) {
    console.error(`❌ AMM calculation error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Calculate estimated output from input using constant product formula
 * @param {number} poolX - Input asset pool balance
 * @param {number} poolY - Output asset pool balance
 * @param {number} input - Input amount
 * @param {number} tradingFeeUnits - Trading fee in XRPL units (1 unit = 0.001%, max 1000 = 1%)
 * @returns {Object} Calculation result with estimated output
 */
export function calculateEstimateOutput(poolX, poolY, input, tradingFeeUnits = 0) {
  try {
    console.log(`🧮 Calculating estimated output:`);
    console.log(`   Pool: ${poolX} (input) / ${poolY} (output)`);
    console.log(`   Input: ${input}`);
    console.log(`   Trading Fee: ${tradingFeeUnits} XRPL fee units (${(tradingFeeUnits/1000).toFixed(3)}%)`);
    
    const k = poolX * poolY; // constant product
    const newPoolX = poolX + parseFloat(input);
    const newPoolY = k / newPoolX;
    const grossOutput = poolY - newPoolY;
    
    // Apply trading fee (fee is deducted from output)
    // Per XRPL docs: fee units are in 1/100,000; value of 1 = 0.001%, max 1000 = 1%
    const tradingFeeDecimal = tradingFeeUnits / 100000;
    const netOutput = grossOutput * (1 - tradingFeeDecimal);
    
    console.log(`   Gross output: ${grossOutput.toFixed(6)}`);
    console.log(`   Net output (after ${tradingFeeUnits} fee units): ${netOutput.toFixed(6)}`);
    
    return {
      success: true,
      estimatedOutput: netOutput,
      grossOutput: grossOutput,
      tradingFeeAmount: grossOutput - netOutput,
      newPoolX: newPoolX,
      newPoolY: newPoolY,
      pricePerUnit: parseFloat(input) / netOutput
    };
  } catch (error) {
    console.error(`❌ Output calculation error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
} 