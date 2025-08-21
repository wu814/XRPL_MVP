import BigNumber from "bignumber.js";
import { IssuedCurrencyAmount } from "xrpl";
import { FormattedAMMInfo } from "@/types/xrpl/ammXRPLTypes";
import { EstimateDepositAmountsResult } from "@/types/helperTypes";

// More precise single-asset deposit formula that accounts for XRPL's internal rounding
function computeLPFromSingleAsset(
  B: BigNumber,  // Amount of asset being deposited
  P: BigNumber,  // Total amount of the deposit asset in the pool
  T: BigNumber,  // Total outstanding LP Tokens before the deposit
  F: BigNumber,  // Trading fee as decimal
  W: BigNumber   // Weight (0.5 for all AMM pools)
): BigNumber {
  // Implement the exact formula from the document:
  // L = T * [ (1 + (B - (F * (1 - W) * B)) / P)^W - 1 ]
  
  // Step 1: Calculate F * (1 - W) * B
  const feeComponent = F.times(new BigNumber(1).minus(W)).times(B);
  
  // Step 2: Calculate B - (F * (1 - W) * B)
  const adjustedAmount = B.minus(feeComponent);
  
  // Step 3: Calculate (B - (F * (1 - W) * B)) / P
  const ratio = adjustedAmount.div(P);
  
  // Step 4: Calculate 1 + ratio
  const base = new BigNumber(1).plus(ratio);
  
  // Step 5: Calculate (1 + ratio)^W
  // Since W = 0.5 for all AMM pools, use sqrt() for better precision
  // If W ever changes, we can add logic to handle other cases
  let power: BigNumber;
  if (W.eq(0.5)) {
    power = base.sqrt();
  } else {
    // For non-0.5 weights, we'd need to handle differently
    // For now, throw an error as this shouldn't happen with current XRPL
    throw new Error(`Unsupported weight: ${W}. Only 0.5 is currently supported.`);
  }
  
  // Step 6: Calculate (1 + ratio)^W - 1
  const result = power.minus(1);
  
  // Step 7: Calculate T * result
  return T.times(result);
}

// Binary search for deposit estimate
function solveDepositAmount(
  P: BigNumber,
  T: BigNumber,
  F: BigNumber,
  W: BigNumber,
  desiredL: BigNumber
): BigNumber {
  let low = new BigNumber(0);
  let high = P.times(desiredL.div(T).times(10)); // broader upper bound
  let mid: BigNumber = new BigNumber(0);
  const epsilon = new BigNumber(1e-8);

  for (let i = 0; i < 100; i++) {
    mid = low.plus(high).div(2);
    const result = computeLPFromSingleAsset(mid, P, T, F, W);

    const diff = result.minus(desiredL);
    if (diff.abs().lt(epsilon)) break;

    if (diff.lt(0)) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return mid;
}

/**
 * Main estimator for LP deposits.
 */
export default function estimateDepositAmounts(
  ammInfo: FormattedAMMInfo,
  lpTokenValue: number,
  payWith: string,
  slippagePercentage: number,
): EstimateDepositAmountsResult {
  const totalLP = new BigNumber(ammInfo?.lpToken?.value || "0");
  const poolA = new BigNumber(ammInfo?.formattedAmount1?.value || "0");
  const poolB = new BigNumber(ammInfo?.formattedAmount2?.value || "0");
  const desiredLP = new BigNumber(lpTokenValue);
  const feeDecimal = new BigNumber(ammInfo?.tradingFee || 0).div(1_000_000);
  const weight = new BigNumber(0.5);
  const slippageDecimal = new BigNumber(1 + slippagePercentage / 100); // Convert slippage to BigNumber safely

  if (
    desiredLP.isNaN() ||
    totalLP.isNaN() ||
    poolA.isNaN() ||
    poolB.isNaN() ||
    slippageDecimal.isNaN()
  ) {
    return {
      amount1: null,
      amount2: null,
      singleAmount: null,
      maxSingleAmount: null,
      emptyAmount: null,
    };
  }

  const ratio = desiredLP.div(totalLP);

  const amount1: IssuedCurrencyAmount = {
    currency: ammInfo?.formattedAmount1?.currency,
    issuer: ammInfo?.formattedAmount1?.issuer,
    value: ratio.times(poolA).toFixed(6),
  };
  const amount2: IssuedCurrencyAmount = {
    currency: ammInfo?.formattedAmount2?.currency,
    issuer: ammInfo?.formattedAmount2?.issuer,
    value: ratio.times(poolB).toFixed(6),
  };

  let singleAmount: IssuedCurrencyAmount | null = null;
  let maxSingleAmount: IssuedCurrencyAmount | null = null;
  let emptyAmount: IssuedCurrencyAmount | null = null;

  if (payWith === ammInfo?.formattedAmount1?.currency) {
    // Calculate for first currency
    const value = solveDepositAmount(poolA, totalLP, feeDecimal, weight, desiredLP);
    const roundedUp = new BigNumber(value).decimalPlaces(6, BigNumber.ROUND_UP);
    
    singleAmount = {
      currency: ammInfo?.formattedAmount1?.currency,
      issuer: ammInfo?.formattedAmount1?.issuer,
      value: roundedUp.toFixed(6),
    };
    maxSingleAmount = {
      ...singleAmount,
      value: roundedUp.times(slippageDecimal).toFixed(6),
    };
    emptyAmount = {
      currency: ammInfo?.formattedAmount2?.currency,
      issuer: ammInfo?.formattedAmount2?.issuer,
      value: "0",
    };
  } else if (payWith === ammInfo?.formattedAmount2?.currency) {
    // Calculate for second currency
    const value = solveDepositAmount(poolB, totalLP, feeDecimal, weight, desiredLP);
    const roundedUp = new BigNumber(value).decimalPlaces(6, BigNumber.ROUND_UP);
    
    singleAmount = {
      currency: ammInfo?.formattedAmount2?.currency,
      issuer: ammInfo?.formattedAmount2?.issuer,
      value: roundedUp.toFixed(6),
    };
    maxSingleAmount = {
      ...singleAmount,
      value: roundedUp.times(slippageDecimal).toFixed(6),
    };
    emptyAmount = {
      currency: ammInfo?.formattedAmount1?.currency,
      issuer: ammInfo?.formattedAmount1?.issuer,
      value: "0",
    };
  }

  return { amount1, amount2, singleAmount, maxSingleAmount, emptyAmount };
}
