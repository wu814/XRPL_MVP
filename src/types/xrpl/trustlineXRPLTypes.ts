import { IssuedCurrencyAmount, Wallet } from "xrpl";
import { YONAWallet } from "../appTypes";
import { ErrorInfo } from "./errorXRPLTypes";

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
  error?: ErrorInfo;
}

export interface SetLPTrustlineParams {
  setterXRPLWallet: Wallet;
  lpToken: IssuedCurrencyAmount;
}