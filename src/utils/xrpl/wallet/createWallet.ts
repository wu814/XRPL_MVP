import { client, connectXRPLClient } from "../testnet";
import { CreateWalletResult, FundWalletResult } from "@/types/xrpl/walletXRPLTypes";



/**
 * Create and fund a new XRPL wallet on testnet
 * @returns Funded wallet and balance information
 */
export async function createWallet(walletType: string): Promise<CreateWalletResult> {
  try {
    await connectXRPLClient();
    
    // Fund the wallet on testnet
    const fundResult: FundWalletResult = await client.fundWallet();
    
    return {
      success: true,
      message: `${walletType} wallet created successfully`,
      data: {
        balance: fundResult.balance,
        wallet: fundResult.wallet,
      }
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to create wallet",
      data: {
        balance: 0,
        wallet: null,
      },
      error: {
        code: "UNKNOWN_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    };
  }
}

export default createWallet;
