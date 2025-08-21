import { ErrorInfo } from "./errorXRPLTypes";

export interface NFTMintResult {
  success: boolean;
  nftTokenID?: string;
  transactionHash?: string;
  uri?: string;
  minterWallet?: string;
  error?: ErrorInfo;
}

export interface NFTSellOfferResult {
  success: boolean;
  offerID?: string;
  error?: ErrorInfo;
}

export interface NFTMintAndListResult {
  success: boolean;
  message: string;
  error?: ErrorInfo;
}

export interface NFTPurchaseResult {
  success: boolean;
  message: string;
  error?: ErrorInfo;
}