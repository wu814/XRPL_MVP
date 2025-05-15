import { client, connectXrplClient } from "./testnet";
import * as xrpl from "xrpl";
import { setIssuerWalletFlags } from "./setIssuerWalletFlags";
import { setTreasuryWalletFlags } from "./setTreasuryWalletFlags";
import { setPathfindWalletFlags } from "./setPathfindWalletFlags";

export async function createWallet(walletType) {
  try {
    await connectXrplClient();

    const fund_result = await client.fundWallet();
    const wallet = fund_result.wallet;

    if (walletType === "ISSUER") {
      setIssuerWalletFlags(wallet);
    }
    else if (walletType === "STANDBY TREASURY"){
      setTreasuryWalletFlags(wallet);
    }
    else if (walletType === "STANDBY PATHFIND") {
      setPathfindWalletFlags(wallet);
    }

    return {
      classicAddress: wallet.address,
      walletType: walletType,
      seed: wallet.seed,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    throw new Error(`[createWallet.js] ${error.message || error}`);
  }
}
