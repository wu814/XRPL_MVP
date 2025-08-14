import { Wallet, AccountInfoResponse } from "xrpl";


export interface FundWalletResult {
  balance: number;
  wallet: Wallet;
}

export interface CreateWalletResult {
  success: boolean;
  message: string;
  data: FundWalletResult;
  error?: string;
}

export interface SetWalletFlagsResult {
  success: boolean;
  error?: string;
}

export type AccountInfo = AccountInfoResponse['result']['account_data'];