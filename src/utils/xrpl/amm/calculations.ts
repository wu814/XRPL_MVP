/**
 * Client-safe AMM calculation utilities
 * No server-side imports - safe for client components
 */

// Import BigNumber for precise decimal calculations
import BigNumber from 'bignumber.js';

// Type definitions
export interface AMMCalculationResult {
  success: boolean;
  exactInput?: number;
  inputWithSlippage?: number;
  pricePerUnit?: number;
  newPoolX?: number;
  newPoolY?: number;
  slippageAmount?: number;
  tradingFeeAdjustment?: number;
  adjustedOutput?: number;
  error?: string;
}

export interface OutputCalculationResult {
  success: boolean;
  estimatedOutput?: number;
  grossOutput?: number;
  tradingFeeAmount?: number;
  newPoolX?: number;
  newPoolY?: number;
  pricePerUnit?: number;
  error?: string;
}

/**
 * Calculate exact AMM input needed for a specific output using constant product formula
 * @param poolX - Input asset pool balance (accepts string or number)
 * @param poolY - Output asset pool balance (accepts string or number)
 * @param desiredOutput - Desired output amount (accepts string or number)
 * @param slippageTolerance - Slippage tolerance (default 0.01 = 1%, accepts string or number)
 * @param tradingFeeUnits - Trading fee in XRPL units (1 unit = 0.001%, max 1000 = 1%, accepts string or number)
 * @returns Calculation result with exact input needed
 */
export function calculateExactAMMInput(
  poolX: string | number, 
  poolY: string | number, 
  desiredOutput: string | number, 
  slippageTolerance: string | number = 0, 
  tradingFeeUnits: string | number = 0
): AMMCalculationResult {
  try {
    console.log(`🧮 AMM Constant Product Calculation (High Precision):`);
    console.log(`   Initial Pool: ${poolX} (input) / ${poolY} (output)`);
    console.log(`   Desired Output: ${desiredOutput}`);
    console.log(`   Trading Fee: ${tradingFeeUnits} XRPL fee units (${(Number(tradingFeeUnits)/1000).toFixed(3)}%)`);
    
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
    
    if (Number(tradingFeeUnits) > 0) {
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
    console.log(`   With ${Number(slippageTolerance) * 100}% slippage: ${inputWithSlippageBN.toFixed(6)}`);
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
    
  } catch (error: any) {
    console.error(`❌ AMM calculation error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Calculate estimated output from input using constant product formula
 * @param poolX - Input asset pool balance (accepts string or number)
 * @param poolY - Output asset pool balance (accepts string or number)
 * @param input - Input amount (accepts string or number)
 * @param tradingFeeUnits - Trading fee in XRPL units (1 unit = 0.001%, max 1000 = 1%, accepts string or number)
 * @returns Calculation result with estimated output
 */
export function calculateEstimateOutput(
  poolX: string | number, 
  poolY: string | number, 
  input: string | number, 
  tradingFeeUnits: string | number = 0
): OutputCalculationResult {
  try {
    console.log(`🧮 Calculating estimated output:`);
    console.log(`   Pool: ${poolX} (input) / ${poolY} (output)`);
    console.log(`   Input: ${input}`);
    console.log(`   Trading Fee: ${tradingFeeUnits} XRPL fee units (${(Number(tradingFeeUnits)/1000).toFixed(3)}%)`);
    
    // Use BigNumber for precise calculations (unlike original which mixed BigNumber and native math)
    const poolXBN = new BigNumber(poolX);
    const poolYBN = new BigNumber(poolY);
    const inputBN = new BigNumber(input);
    const tradingFeeUnitsBN = new BigNumber(tradingFeeUnits);
    
    // Constant product formula with BigNumber precision
    const k = poolXBN.multipliedBy(poolYBN);
    const newPoolXBN = poolXBN.plus(inputBN);
    const newPoolYBN = k.dividedBy(newPoolXBN);
    const grossOutputBN = poolYBN.minus(newPoolYBN);
    
    // Apply trading fee (fee is deducted from output)
    // Per XRPL docs: fee units are in 1/100,000; value of 1 = 0.001%, max 1000 = 1%
    const tradingFeeDecimalBN = tradingFeeUnitsBN.dividedBy(100000);
    const netOutputBN = grossOutputBN.multipliedBy(new BigNumber(1).minus(tradingFeeDecimalBN));
    const tradingFeeAmountBN = grossOutputBN.minus(netOutputBN);
    
    console.log(`   Gross output: ${grossOutputBN.toFixed(6)}`);
    console.log(`   Net output (after ${tradingFeeUnits} fee units): ${netOutputBN.toFixed(6)}`);
    
    return {
      success: true,
      estimatedOutput: netOutputBN.toNumber(),
      grossOutput: grossOutputBN.toNumber(),
      tradingFeeAmount: tradingFeeAmountBN.toNumber(),
      newPoolX: newPoolXBN.toNumber(),
      newPoolY: newPoolYBN.toNumber(),
      pricePerUnit: inputBN.dividedBy(netOutputBN).toNumber()
    };
  } catch (error: any) {
    console.error(`❌ Output calculation error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}



