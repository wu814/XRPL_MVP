import { client, connectXrplClient } from "../testnet";
import { dropsToXrp } from "xrpl";

interface AccountInfo {
  Account: string;
  Balance: number | string; // Balance in drops or XRP
  Flags: number;
  LedgerEntryType: string;
  OwnerCount: number;
  PreviousTxnID: string;
  PreviousTxnLgrSeq: number;
  Sequence: number;
  TransferRate?: number;
  [key: string]: any;
}

interface AccountLines {
  account: string; 
  balance: string;
  currency: string;
  limit: string;
  limit_peer: string;
  quality_in: number;
  quality_out: number;
  no_ripple: boolean;
  no_ripple_peer: boolean;
  authorized: boolean;
  peer_authorized: boolean;
  freeze: boolean;
  freeze_peer: boolean;
}

interface AccountObjects {
  LedgerEntryType: string;
  [key: string]: any;
}

/**
 * Get account information with balance in XRP
 * @param address - Account address
 * @returns Account information with balance converted to XRP
 */
export async function getAccountInfo(address: string): Promise<AccountInfo> {
  await connectXrplClient();
  
  const response = await client.request({
    command: "account_info",
    account: address,
    ledger_index: "validated",
  });

  const accountData = response.result.account_data as AccountInfo;
  
  // Convert balance from drops to XRP
  if (accountData.Balance) {
    accountData.Balance = dropsToXrp(accountData.Balance);
  }

  return accountData;
}

/**
 * Get account lines (trustlines)
 * @param address - Account address
 * @returns Account trustlines
 */
export async function getAccountLines(address: string): Promise<AccountLines[]> {
  await connectXrplClient();
  
  const response = await client.request({
    command: "account_lines",
    account: address,
    ledger_index: "validated",
  });

  return response.result.lines as AccountLines[];
}

/**
 * Get account objects
 * @param address - Account address
 * @returns Account objects
 */
export async function getAccountObjects(address: string): Promise<AccountObjects[]> {
  await connectXrplClient();
  
  const response = await client.request({
    command: "account_objects",
    account: address,
    ledger_index: "validated",
  });

  return response.result.account_objects as AccountObjects[];
}
