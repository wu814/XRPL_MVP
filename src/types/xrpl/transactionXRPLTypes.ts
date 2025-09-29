import { AccountTxTransaction } from "xrpl";

export type ClawbackResult = {
  success: boolean;
  message?: string;
  errorCode?: string;
}

export type SendCrossCurrencyResult = {
  success: boolean;
  message?: string;
  errorCode?: string;
}

export type SendIOUResult = {
  success: boolean;
  message?: string;
  errorCode?: string;
}

export type SendXRPResult = {
  success: boolean;
  message?: string;
  errorCode?: string;
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