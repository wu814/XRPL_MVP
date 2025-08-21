/**
 * Client-safe AMM calculation utilities
 * No server-side imports - safe for client components
 */

// Import BigNumber for precise decimal calculations
import BigNumber from 'bignumber.js';

// Type definitions - Updated to use BigNumber for precision
export interface AMMCalculationResult {
  success: boolean;
  exactInput?: BigNumber;
  inputWithSlippage?: BigNumber;
  pricePerUnit?: BigNumber;
  newPoolX?: BigNumber;
  newPoolY?: BigNumber;
  slippageAmount?: BigNumber;
  tradingFeeAdjustment?: BigNumber;
  adjustedOutput?: BigNumber;
  error?: string;
}

export interface OutputCalculationResult {
  success: boolean;
  estimatedOutput?: BigNumber;
  tradingFeeAmount?: BigNumber;
  newPoolX?: BigNumber;
  newPoolY?: BigNumber;
  pricePerUnit?: BigNumber;
  error?: string;
}

/**
 * Calculate exact AMM input needed for a specific output using constant product formula
 * @param poolX - Input asset pool balance (accepts string or number)
 * @param poolY - Output asset pool balance (accepts string or number)
 * @param desiredOutput - Desired output amount (accepts string or number)
 * @param slippageDecimal - Slippage tolerance (default 0.01 = 1%, accepts string or number)
 * @param tradingFeeUnits - Trading fee in XRPL units (1 unit = 0.001%, max 1000 = 1%, accepts string or number)
 * @returns Calculation result with exact input needed as BigNumber for precision
 */
export function calculateExactAMMInput(
  poolX: string | number, 
  poolY: string | number, 
  desiredOutput: string | number, 
  slippageDecimal: string | number = 0, 
  tradingFeeDecimal: string | number = 0
): AMMCalculationResult {
  try {
    console.log(`🧮 AMM Constant Product Calculation (High Precision):`);
    console.log(`   Initial Pool: ${poolX} (input) / ${poolY} (output)`);
    console.log(`   Desired Output: ${desiredOutput}`);
    console.log(`   Trading Fee: ${Number(tradingFeeDecimal) * 100}%`);
    
    // Validate inputs
    if (!poolX || !poolY || !desiredOutput) {
      throw new Error("Invalid input: pool balances and desired output must be positive numbers");
    }
    
    if (Number(desiredOutput) <= 0) {
      throw new Error("Desired output must be greater than 0");
    }
    
    if (Number(poolX) <= 0 || Number(poolY) <= 0) {
      throw new Error("Pool balances must be greater than 0");
    }
    
    // Use BigNumber for precise calculations
    const poolXBN = new BigNumber(poolX);
    const poolYBN = new BigNumber(poolY);
    const desiredOutputBN = new BigNumber(desiredOutput);
    const slippageDecimalBN = new BigNumber(slippageDecimal);
    
    // Validate that desired output doesn't exceed pool liquidity
    if (desiredOutputBN.gte(poolYBN)) {
      throw new Error(`Desired output ${desiredOutput} exceeds available pool liquidity ${poolY}`);
    }
    
    console.log(`   Constant k = ${poolXBN.multipliedBy(poolYBN).toFixed()}`);
    
    // Convert XRPL trading fee units to decimal with high precision
    // Per XRPL docs: fee units are in 1/100,000; value of 1 = 0.001%, max 1000 = 1%
    const tradingFeeDecimalBN = new BigNumber(tradingFeeDecimal);
    
    // If there's a trading fee, we need to account for it in our calculation
    let adjustedDesiredOutputBN = desiredOutputBN;
    
    if (Number(tradingFeeDecimal) > 0) {
      // Calculate how much extra we need to request to account for the fee
      // If fee is 1% and we want 100, we need to request ~101.01 so that after 1% fee we get 100
      const oneMinusFee = new BigNumber(1).minus(tradingFeeDecimalBN);
      adjustedDesiredOutputBN = desiredOutputBN.dividedBy(oneMinusFee);
      console.log(`   Fee Adjustment: Requesting ${adjustedDesiredOutputBN.toFixed(6)} to get ${desiredOutput} after ${Number(tradingFeeDecimal) * 100}% fee`);
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
    
    // Validate the calculated input is reasonable
    if (exactInputNeededBN.lte(0)) {
      throw new Error("Calculated input amount is invalid (zero or negative)");
    }
    
    // Apply slippage tolerance
    const inputWithSlippageBN = exactInputNeededBN.multipliedBy(new BigNumber(1).plus(slippageDecimalBN));
    
    // Round to reasonable precision to avoid XRPL precision errors
    // For IOU tokens, use 15 decimal places; for XRP, use 6
    const maxPrecision = 15;
    const roundedInputWithSlippage = inputWithSlippageBN.toFixed(maxPrecision);
    const roundedExactInput = exactInputNeededBN.toFixed(maxPrecision);
    
    console.log(`   After withdrawal: ${newPoolXBN.toFixed(6)} / ${newPoolYBN.toFixed(6)}`);
    console.log(`   Exact input needed: ${roundedExactInput}`);
    console.log(`   With ${Number(slippageDecimal) * 100}% slippage: ${roundedInputWithSlippage}`);
    console.log(`   Price per unit: ${exactInputNeededBN.dividedBy(desiredOutputBN).toFixed(6)}`);
    
    return {
      success: true,
      exactInput: new BigNumber(roundedExactInput),
      inputWithSlippage: new BigNumber(roundedInputWithSlippage),
      pricePerUnit: exactInputNeededBN.dividedBy(desiredOutputBN),
      newPoolX: newPoolXBN,
      newPoolY: newPoolYBN,
      slippageAmount: inputWithSlippageBN.minus(exactInputNeededBN),
      tradingFeeAdjustment: adjustedDesiredOutputBN.minus(desiredOutputBN),
      adjustedOutput: adjustedDesiredOutputBN
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
 * @returns Calculation result with estimated output as BigNumber for precision
 */
export function calculateEstimateOutput(
  poolX: string | number, 
  poolY: string | number, 
  input: string | number, 
  tradingFeeDecimal: string | number = 0
): OutputCalculationResult {
  try {
    console.log(`🧮 Calculating estimated output:`);
    console.log(`   Pool: ${poolX} (input) / ${poolY} (output)`);
    console.log(`   Input: ${input}`);
    console.log(`   Trading Fee: ${Number(tradingFeeDecimal) * 100}%`);
    
    // Use BigNumber for precise calculations
    const poolXBN = new BigNumber(poolX);
    const poolYBN = new BigNumber(poolY);
    const inputBN = new BigNumber(input);
    const tradingFeeDecimalBN = new BigNumber(tradingFeeDecimal);
    
    // Calculate output without fee first
    const k = poolXBN.multipliedBy(poolYBN);
    const newPoolXBN = poolXBN.plus(inputBN); // Use full input
    const newPoolYBN = k.dividedBy(newPoolXBN);
    const grossOutputBN = poolYBN.minus(newPoolYBN);

    // Then deduct fee from the output
    const netOutputBN = grossOutputBN.multipliedBy(new BigNumber(1).minus(tradingFeeDecimalBN));
    
    console.log(`   Fee amount: ${inputBN.multipliedBy(tradingFeeDecimalBN).toFixed(6)}`);
    console.log(`   Net output (fee already applied): ${netOutputBN.toFixed(6)}`);
    
    return {
      success: true,
      estimatedOutput: netOutputBN,
      tradingFeeAmount: inputBN.multipliedBy(tradingFeeDecimalBN),
      newPoolX: newPoolXBN,
      newPoolY: newPoolYBN,
      pricePerUnit: inputBN.dividedBy(netOutputBN)
    };
  } catch (error: any) {
    console.error(`❌ Output calculation error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}



