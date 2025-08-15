import { AMMInfoResponse } from "xrpl";

export type AMMInfo = AMMInfoResponse["result"]["amm"];

export type AMMData = {
  account: string;
  currency1: string;
  currency2: string;
  created_at: string;
  issuer_address: string;
  treasury_address: string;
}