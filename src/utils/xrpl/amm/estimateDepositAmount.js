import BigNumber from "bignumber.js";

// Helper function for LP estimation from single asset
function computeLPFromSingleAsset(B, P, T, F, W) {
  const adjustedB = B.minus(F.times(new BigNumber(1).minus(W)).times(B));
  const base = new BigNumber(1).plus(adjustedB.div(P));
  const power = new BigNumber(Math.pow(base.toNumber(), 0.5));
  return T.times(power.minus(1));
}

// Binary search for deposit estimate
function solveDepositAmount(P, T, F, W, desiredL) {
  let low = new BigNumber(0);
  let high = P.times(desiredL.div(T).times(10)); // broader upper bound
  let mid;
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
export default function estimateDepositAmounts({
  token1,
  token2,
  ammInfo,
  lpAmount,
  payWith,
  slippage,
}) {
  const totalLP = new BigNumber(ammInfo?.lp_token?.value);
  const poolA = new BigNumber(token1?.value);
  const poolB = new BigNumber(token2?.value);
  const desiredLP = new BigNumber(lpAmount);
  const fee = new BigNumber(ammInfo?.trading_fee).div(1_000_000);
  const weight = new BigNumber(0.5);
  const slip = new BigNumber(1 + slippage / 100); // Convert slippage to BigNumber safely

  if (
    desiredLP.isNaN() ||
    totalLP.isNaN() ||
    poolA.isNaN() ||
    poolB.isNaN() ||
    slip.isNaN()
  ) {
    return {
      assetA: null,
      assetB: null,
      singleAsset: null,
      maxSingleAsset: null,
    };
  }

  const ratio = desiredLP.div(totalLP);

  const assetA = {
    currency: token1.currency,
    issuer: token1.issuer,
    value: ratio.times(poolA).toFixed(6),
  };
  const assetB = {
    currency: token2.currency,
    issuer: token2.issuer,
    value: ratio.times(poolB).toFixed(6),
  };

  let singleAsset = null;
  let maxSingleAsset = null;

  if (payWith === token1.currency) {
    const value = solveDepositAmount(poolA, totalLP, fee, weight, desiredLP);
    singleAsset = {
      currency: token1.currency,
      issuer: token1.issuer,
      value: value.toFixed(6),
    };
    maxSingleAsset = {
      ...singleAsset,
      value: value.times(slip).toFixed(6),
    };
  } else if (payWith === token2.currency) {
    const value = solveDepositAmount(poolB, totalLP, fee, weight, desiredLP);
    singleAsset = {
      currency: token2.currency,
      issuer: token2.issuer,
      value: value.toFixed(6),
    };
    maxSingleAsset = {
      ...singleAsset,
      value: value.times(slip).toFixed(6),
    };
  }

  return { assetA, assetB, singleAsset, maxSingleAsset };
}
