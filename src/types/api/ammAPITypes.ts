import { YONAWallet } from "@/types/appTypes";
import { AMMData, CreateAMMResult, FormattedAMMInfo } from "@/types/xrpl/ammXRPLTypes";
import { IssuedCurrencyAmount } from "xrpl";


export interface GetAllAMMDataAPIResponse {
  message: string;
  data: AMMData[];
}

export interface GetFormattedAMMInfoAPIRequest {
  account: string;
}

export interface GetFormattedAMMInfoAPIResponse {
  message: string;
  data: FormattedAMMInfo;
}

export interface CreateAMMAPIRequest {
  treasuryWallet: YONAWallet;
  issuerWallets: YONAWallet[];
  currency1: string;
  value1: number;
  currency2: string;
  value2: number;
  tradingFee: number;
}

export interface CreateAMMAPIResponse {
  message: string;
  data: CreateAMMResult;
}

export interface GetFormattedAMMInfoByCurrenciesAPIRequest {
  sellCurrency: string;
  buyCurrency: string;
}

export interface GetFormattedAMMInfoByCurrenciesAPIResponse {
  message: string;
  data: FormattedAMMInfo;
}

export interface AddLiquidityAPIRequest {
  depositType: "twoAsset" | "twoAssetLPToken" | "oneAsset" | "oneAssetLPToken";
  wallet: YONAWallet;
  ammInfo: FormattedAMMInfo;
  addValue1?: string;
  addValue2?: string;
  lpTokenValue?: string;
  selectedCurrency?: string;
}

export interface AddLiquidityAPIResponse {
  message: string;
}

export interface WithdrawLiquidityAPIRequest {
  mode: "twoAsset" | "lpToken" | "all" | "singleAsset" | "singleAssetAll" | "singleAssetLp";
  withdrawerWallet: YONAWallet;
  ammInfo: FormattedAMMInfo;
  withdrawValue1?: string;
  withdrawValue2?: string;
  singleWithdrawCurrency?: string;
  singleWithdrawValue?: string;
  lpTokenValue?: string;
}

export interface WithdrawLiquidityAPIResponse {
  message: string;
  poolDeleted?: boolean;
}