import { AMMInfoResponse, IssuedCurrencyAmount, Wallet, Currency } from "xrpl";
import { ErrorInfo } from "@/types/xrpl/errorXRPLTypes";

export type AMMInfo = AMMInfoResponse["result"]["amm"];

// AMM data from the database
export type AMMData = {
  account: string;
  currency1: string;
  currency2: string;
  createdAt?: string;
  issuerAddress?: string;
  treasuryAddress?: string;
};

export type CreateAMMResult = {
  success: boolean;
  error?: ErrorInfo;
  account: string;
  currency1: string;
  currency2: string;
};

// amount field is the same for XRP and other currencies, {currency, issuer, value}
export interface FormattedAMMInfo {
  account: string | null;
  formattedAmount1: IssuedCurrencyAmount;
  formattedAmount2: IssuedCurrencyAmount;
  assetFrozen?: boolean;
  asset2Frozen?: boolean;
  auctionSlot?: {
    account: string;
    authAccounts: { account: string }[];
    discountedFee: number;
    expiration: string;
    price: IssuedCurrencyAmount;
    timeInterval: number;
  };
  lpToken: IssuedCurrencyAmount;
  tradingFee: number;
  voteSlots?: {
    account: string;
    tradingFee: number;
    voteWeight: number;
  }[];
}


export interface AddLiquiditySingleAssetParams {
  providerXRPLWallet: Wallet;
  ammAccount: string;
  formattedAmount: IssuedCurrencyAmount;
  emptyAmount: IssuedCurrencyAmount;
}

export interface AddLiquidityOneAssetLPTokenParams {
  providerXRPLWallet: Wallet;
  ammAccount: string;
  formattedAmount: IssuedCurrencyAmount;
  emptyAmount: IssuedCurrencyAmount;
  lpTokenOut: IssuedCurrencyAmount;
}

// General Add Liquidity Result
export interface AddLiquidityResult {
  success: boolean;
  error?: ErrorInfo;
  message?: string;
}

export interface WithdrawLiquidityResult {
  success: boolean;
  error?: ErrorInfo;
  message?: string;
}