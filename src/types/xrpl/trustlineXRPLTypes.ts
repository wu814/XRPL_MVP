import { IssuedCurrencyAmount, Wallet } from "xrpl";
import { YONAWallet } from "../appTypes";

export interface CheckTrustlineParams {
  walletAddress: string;
  destination: string;
  currency: string;
}

export interface SetTrustlineParams {
  setterXRPLWallet: Wallet;
  issuerWalletAddress: string;
  currency: string;
  issuerWallets?: YONAWallet[] | null;
}

export interface SetTrustlineResult {
  success: boolean;
  message?: string;
  errorCode?: string;
}

export interface SetLPTrustlineParams {
  setterXRPLWallet: Wallet;
  lpToken: IssuedCurrencyAmount;
}