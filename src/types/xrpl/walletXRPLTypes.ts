import { Wallet, AccountInfoResponse } from "xrpl";

export interface FundWalletResult {
  balance: number;
  wallet: Wallet;
}

export interface CreateWalletResult {
  success: boolean;
  message: string;
  data: FundWalletResult;
  errorCode?: string;
}

export interface SetWalletFlagsResult {
  success: boolean;
  errorCode?: string;
  message?: string;
}

export type AccountInfo = AccountInfoResponse['result']['account_data'];