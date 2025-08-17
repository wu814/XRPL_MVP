import { IssuedCurrencyAmount, Wallet } from "xrpl";
import { YONAWallet } from "../appTypes";

export interface CheckTrustlineAPIRequest {
  walletAddress: string;
  destination: string;
  currency: string;
}

export interface CheckTrustlineAPIResponse {
  hasTrustline: boolean;
}

export interface SetWalletTrustlineAPIRequest {
  setterWallet: YONAWallet;
  issuerWallets: YONAWallet[];
  currency: string;
}

export interface SetWalletTrustlineAPIResponse {
  message: string;
}

export interface SetLPTrustlineAPIRequest {
  setterWallet: YONAWallet;
  lpToken: IssuedCurrencyAmount;
}

export interface SetLPTrustlineAPIResponse {
  message: string;
}


