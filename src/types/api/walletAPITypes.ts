import { YONAWallet } from "@/types/appTypes";
import { AccountInfo } from "@/types/xrpl/walletXRPLTypes";
import { AccountLinesTrustline, AccountObject } from "xrpl";

export interface CreateWalletAPIRequest {
  walletType: string;
}

export interface CreateWalletAPIResponse {
  message: string;
  data: YONAWallet;
}

export interface SetWalletFlagsAPIRequest {
  wallet: YONAWallet;
}

export interface SetWalletFlagsAPIResponse {
  message: string;
}

export interface GetAccountInfoAPIRequest {
  wallet: YONAWallet;
}

export interface GetAccountInfoAPIResponse {
  message: string;
  data: AccountInfo;
}

export interface GetAccountLinesAPIRequest {
  wallet: YONAWallet;
}

export interface GetAccountLinesAPIResponse {
  message: string;
  data: AccountLinesTrustline[];
}

export interface GetAccountObjectsAPIRequest {
  wallet: YONAWallet;
}

export interface GetAccountObjectsAPIResponse {
  message: string;
  data: AccountObject[];
}

export interface GetTreasuryWalletAPIResponse {
  message: string;
  data: YONAWallet;
}