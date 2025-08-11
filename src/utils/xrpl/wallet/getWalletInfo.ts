import { client, connectXrplClient } from "../testnet";

interface AccountInfo {
  Account: string;
  Balance: string;
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
  currency: string;
  account: string;
  balance: string;
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
  [key: string]: any;
}

interface AccountObjects {
  LedgerEntryType: string;
  [key: string]: any;
}

/**
 * Get account information
 * @param address - Account address
 * @returns Account information
 */
export async function getAccountInfo(address: string): Promise<AccountInfo> {
  await connectXrplClient();
  
  const response = await client.request({
    command: "account_info",
    account: address,
    ledger_index: "validated",
  });

  return response.result.account_data as AccountInfo;
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
