import { FundWalletResult } from "@/types/xrpl/wallet/walletXRPLTypes";
import { YONAWallet } from "@/types/appTypes";

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