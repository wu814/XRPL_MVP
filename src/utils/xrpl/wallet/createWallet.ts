import { client, connectXrplClient } from "../testnet";
import * as xrpl from "xrpl";

interface FundWalletResult {
  classicAddress: string;
  walletType: string;
  seed: string;
}

/**
 * Create and fund a new XRPL wallet on testnet
 * @returns Funded wallet and balance information
 */
export async function createWallet(walletType: string): Promise<FundWalletResult> {
  await connectXrplClient();
  
  // Fund the wallet on testnet
  const fundResult = await client.fundWallet();
  const wallet = fundResult.wallet;
  
  return {
    classicAddress: wallet.address,
    walletType: walletType,
    seed: wallet.seed,
  };
}

export default createWallet;
