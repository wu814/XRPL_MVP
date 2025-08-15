import { YONAWallet } from "@/types/appTypes";
import { AMMData, AMMInfo, CreateAMMResult, FormattedAMMInfo } from "@/types/xrpl/index";


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