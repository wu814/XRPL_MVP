import { IssuedCurrencyAmount } from "xrpl";

export interface EstimateDepositAmountsResult {
  amount1: IssuedCurrencyAmount | null;
  amount2: IssuedCurrencyAmount | null;
  singleAmount: IssuedCurrencyAmount | null;
  maxSingleAmount: IssuedCurrencyAmount | null;
  emptyAmount: IssuedCurrencyAmount | null;
}