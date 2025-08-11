import { client, connectXrplClient } from "../testnet";
import * as xrpl from "xrpl";

interface FundWalletResult {
  wallet: xrpl.Wallet;
  balance: number;
}

/**
 * Create and fund a new XRPL wallet on testnet
 * @returns Funded wallet and balance information
 */
export async function createWallet(): Promise<FundWalletResult> {
  await connectXrplClient();
  
  // Fund the wallet on testnet
  const fundResult = await client.fundWallet();
  const wallet = fundResult.wallet;
  
  return {
    wallet: fundResult.wallet,
    balance: fundResult.balance
  };
}

export default createWallet;
