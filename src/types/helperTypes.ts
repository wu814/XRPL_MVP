import { IssuedCurrencyAmount } from "xrpl";
import { FormattedAMMInfo } from "./xrpl/ammXRPLTypes";

// Estimate deposit amounts (estimateDepositAmounts.ts)
export interface EstimateDepositAmountsParams {
  ammInfo: FormattedAMMInfo;
  lpAmount: number;
  payWith: string;
  slippagePercentage: number;
}

export interface EstimateDepositAmountsResult {
  amount1: IssuedCurrencyAmount | null;
  amount2: IssuedCurrencyAmount | null;
  singleAmount: IssuedCurrencyAmount | null;
  maxSingleAmount: IssuedCurrencyAmount | null;
  emptyAmount: IssuedCurrencyAmount | null;
}