import { YONAWallet } from "../appTypes";

export interface SmartTradeAPIRequest {
  senderWallet: YONAWallet;
  sendCurrency: string;
  sendAmount?: string | number;
  receiveCurrency: string;
  issuerAddress: string;
  slippagePercent?: number;
  paymentType?: "exact_input" | "exact_output";
  exactOutputAmount?: string | number;
}

export interface SmartTradeAPIResponse {
  message: string;
}