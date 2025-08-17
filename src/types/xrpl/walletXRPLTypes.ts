import { Wallet, AccountInfoResponse } from "xrpl";
import { ErrorInfo } from "@/types/xrpl/errorXRPLTypes";

export interface FundWalletResult {
  balance: number;
  wallet: Wallet;
}

export interface CreateWalletResult {
  success: boolean;
  message: string;
  data: FundWalletResult;
  error?: ErrorInfo;
}

export interface SetWalletFlagsResult {
  success: boolean;
  error?: ErrorInfo;
}

export type AccountInfo = AccountInfoResponse['result']['account_data'];