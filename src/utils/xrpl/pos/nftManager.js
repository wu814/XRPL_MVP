

/**
 * Calculate exact input needed for AMM swap with trading fee consideration
 * @param {number} poolX - Pool balance for input currency
 * @param {number} poolY - Pool balance for output currency  
 * @param {number} desiredOutput - Desired output amount
 * @param {number} slippageTolerance - Slippage tolerance (e.g., 0.05 for 5%)
 * @param {number} tradingFeeBasisPoints - Trading fee in basis points (0-1000, default 0)
 * @returns {Object} Calculation result with exact input needed
 */
export function calculateExactAMMInput(poolX, poolY, desiredOutput, slippageTolerance = 0.01, tradingFeeBasisPoints = 0) {
  try {
    console.log(`🧮 AMM Constant Product Calculation:`);
    console.log(`   Initial Pool: ${poolX} (input) / ${poolY} (output)`);
    console.log(`   Desired Output: ${desiredOutput}`);
    console.log(`   Trading Fee: ${tradingFeeBasisPoints} basis points (${tradingFeeBasisPoints/100}%)`);
    console.log(`   Constant k = ${poolX * poolY}`);
    
    // Convert trading fee from basis points to decimal (100 basis points = 1%)
    const tradingFeeDecimal = tradingFeeBasisPoints / 10000;
    
    // If there's a trading fee, we need to account for it in our calculation
    // The AMM will deduct the fee from the output, so we need to request more
    // to ensure we get exactly the desired amount after fees
    let adjustedDesiredOutput = desiredOutput;
    
    if (tradingFeeBasisPoints > 0) {
      // Calculate how much extra we need to request to account for the fee
      // If fee is 1% and we want 100, we need to request ~101.01 so that after 1% fee we get 100
      adjustedDesiredOutput = desiredOutput / (1 - tradingFeeDecimal);
      console.log(`   Fee Adjustment: Requesting ${adjustedDesiredOutput.toFixed(6)} to get ${desiredOutput} after ${tradingFeeBasisPoints}bps fee`);
    }
    
    // Constant product formula: X * Y = k
    const k = poolX * poolY;
    
    // After taking adjustedDesiredOutput from poolY:
    // newPoolY = poolY - adjustedDesiredOutput
    const newPoolY = poolY - adjustedDesiredOutput;
    
    if (newPoolY <= 0) {
      throw new Error(`Insufficient liquidity: Cannot withdraw ${adjustedDesiredOutput} from pool of ${poolY}`);
    }
    
    // Calculate newPoolX using k = newPoolX * newPoolY
    // newPoolX = k / newPoolY
    const newPoolX = k / newPoolY;
    
    // Input needed = newPoolX - poolX
    const exactInputNeeded = newPoolX - poolX;
    
    // Apply slippage tolerance
    const inputWithSlippage = exactInputNeeded * (1 + slippageTolerance);
    
    console.log(`   After withdrawal: ${newPoolX.toFixed(6)} / ${newPoolY.toFixed(6)}`);
    console.log(`   Exact input needed: ${exactInputNeeded.toFixed(6)}`);
    console.log(`   With ${(slippageTolerance * 100).toFixed(1)}% slippage: ${inputWithSlippage.toFixed(6)}`);
    console.log(`   Price per unit: ${(exactInputNeeded / desiredOutput).toFixed(6)}`);
    
    return {
      success: true,
      exactInput: exactInputNeeded,
      inputWithSlippage: inputWithSlippage,
      pricePerUnit: exactInputNeeded / desiredOutput,
      newPoolX: newPoolX,
      newPoolY: newPoolY,
      slippageAmount: inputWithSlippage - exactInputNeeded,
      tradingFeeAdjustment: adjustedDesiredOutput - desiredOutput,
      adjustedOutput: adjustedDesiredOutput
    };
    
  } catch (error) {
    console.error(`❌ AMM calculation error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
};