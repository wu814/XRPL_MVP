import { ErrorInfo } from "@/types/xrpl/errorXRPLTypes";
import { AccountTxTransaction } from "xrpl";

export type SendCrossCurrencyResult = {
  success: boolean;
  message?: string;
  error?: ErrorInfo;
}

export type SendIOUResult = {
  success: boolean;
  message?: string;
  error?: ErrorInfo;
}

export type SendXRPResult = {
  success: boolean;
  message?: string;
  error?: ErrorInfo;
}

export interface ProcessedTransaction {
  hash: string;
  ledger_index: number | null;
  date: Date | null;
  type: string;
  direction: string;
  counterparty: string | null;
  amount: string | number | null;
  currency: string;
  fee: string | null;
  validated: boolean;
  result: string;
  raw: AccountTxTransaction;
}

export interface GetAccountTransactionsResult {
  transactions: ProcessedTransaction[];
  marker: string | null;
  message?: string;
}