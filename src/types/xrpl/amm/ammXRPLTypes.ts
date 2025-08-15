import { AMMInfoResponse, IssuedCurrencyAmount } from "xrpl";

export type AMMInfo = AMMInfoResponse["result"]["amm"];


// AMM data from the database
export type AMMData = {
  account: string;
  currency1: string;
  currency2: string;
  createdAt?: string;
  issuerAddress?: string;
  treasuryAddress?: string;
}

export type CreateAMMResult = {
  success: boolean;
  error?: {
    code: string;
    message: string;
  };
  account: string;
  currency1: string;
  currency2: string;
}


// amount field is the same for XRP and other currencies, {currency, issuer, value}
export interface FormattedAMMInfo {
  account: string;
  formattedAmount: IssuedCurrencyAmount;
  formattedAmount2: IssuedCurrencyAmount;
  tradingFee: number;
}
