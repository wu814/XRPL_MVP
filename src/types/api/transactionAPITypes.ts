import { YONAWallet } from "../wallet";

export interface sendCrossCurrencyAPIRequest {
  senderWallet: YONAWallet;
  recipient: string;
  sendCurrency: string;
  sendAmount?: string | number;
  receiveCurrency: string;
  issuerAddress: string;
  slippagePercent?: number;
  destinationTag?: number | null;
  useUsername?: boolean;
  paymentType?: "exact_input" | "exact_output";
  exactOutputAmount?: string | number;
}

export interface sendCrossCurrencyAPIResponse {
  message: string;
}

export interface sendIOUAPIRequest {
  senderWallet: YONAWallet;
  recipient: string;
  amount: string | number;
  currency: string;
  issuerWallets: YONAWallet[];
  destinationTag?: number | null;
  useUsername?: boolean;
}

export interface sendIOUAPIResponse {
  message: string;
}

export interface sendXRPAPIRequest {
  senderWallet: YONAWallet;
  recipientUsername?: string;
  recipientAddress?: string;
  recipient?: string;
  amount: string | number;
  destinationTag?: number | null;
  useUsername?: boolean;
}

export interface sendXRPAPIResponse {
  message: string;
}