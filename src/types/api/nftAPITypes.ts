import { YONAWallet } from "../appTypes";

export interface BuyNFTAPIRequest {
  offerID: string;
  paymentCurrency: string;
  issuerWalletAddress: string;
  userWallet: YONAWallet
} 

export interface BuyNFTAPIResponse {
  message: string;
}

export interface MintAndListNFTAPIRequest {
  userWallet: YONAWallet;
  issuerWalletAddress: string;
  uri: string;
  priceUSD: string | number;
  destination?: string | null;
  taxon?: number;
}

export interface MintAndListNFTAPIResponse {
  message: string;
}
