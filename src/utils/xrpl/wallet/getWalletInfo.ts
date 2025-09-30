import { client, connectXRPLClient } from "../testnet";
import { dropsToXrp, AccountLinesTrustline, AccountObject, AccountInfoResponse, AccountLinesResponse, AccountObjectsResponse } from "xrpl";
import { AccountInfo } from "@/types/xrpl/walletXRPLTypes";


/**
 * Get account information with balance in XRP
 * @param address - Account address
 * @returns Account information with balance converted to XRP
 */
export async function getAccountInfo(address: string): Promise<AccountInfo> {
  await connectXRPLClient();
  
  const response: AccountInfoResponse = await client.request({
    command: "account_info",
    account: address,
    ledger_index: "validated",
  });



  const accountData = response.result.account_data;
  
  // Convert balance from drops to XRP
  if (accountData.Balance) {
    accountData.Balance = dropsToXrp(accountData.Balance).toString();
  }

  return accountData;
}

/**
 * Get account lines (trustlines)
 * @param address - Account address
 * @returns Account trustlines
 */
export async function getAccountLines(address: string): Promise<AccountLinesTrustline[]> {
  await connectXRPLClient();
  
  const response: AccountLinesResponse = await client.request({
    command: "account_lines",
    account: address,
    ledger_index: "validated",
  });

  return response.result.lines;
}

/**
 * Get account objects
 * @param address - Account address
 * @returns Account objects
 */
export async function getAccountObjects(address: string): Promise<AccountObject[]> {
  await connectXRPLClient();
  
  const response: AccountObjectsResponse = await client.request({
    command: "account_objects",
    account: address,
    ledger_index: "validated",
  });

  return response.result.account_objects;
}
