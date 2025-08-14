import { Wallet } from "xrpl";


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

export interface WalletFlagsResult {
  success: boolean;
  error?: string;
}