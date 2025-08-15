import { YONAWallet } from "@/types/appTypes";
import { AMMData, AMMInfo, CreateAMMResult, FormattedAMMInfo } from "@/types/xrpl/index";


export interface GetAllAMMDataAPIResponse {
  message: string;
  data: AMMData[];
}

export interface GetAMMInfoAPIRequest {
  account: string;
}

export interface GetAMMInfoAPIResponse {
  message: string;
  data: AMMInfo;
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