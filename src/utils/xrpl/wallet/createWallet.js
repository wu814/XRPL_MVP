import { client, connectXrplClient } from "../testnet";
import * as xrpl from "xrpl";
import setIssuerWalletFlags from "./setIssuerWalletFlags";
import setTreasuryWalletFlags from "./setTreasuryWalletFlags";
import setPathfindWalletFlags from "./setPathfindWalletFlags";



const SEED = "sEdVbmDXc3D52mCtwi87GEFtXnLhwv7";
export default async function createWallet(walletType) {
  await connectXrplClient();
  // const fund_result = await client.fundWallet();
  // const wallet = fund_result.wallet;
  const wallet = xrpl.Wallet.fromSeed(SEED);
  console.log("Wallet created:", wallet);

  // if (walletType === "ISSUER") {
  //   await setIssuerWalletFlags(wallet);
  // } else if (walletType === "STANDBY TREASURY") {
  //   setTreasuryWalletFlags(wallet);
  // } else if (walletType === "STANDBY PATHFIND") {
  //   setPathfindWalletFlags(wallet);
  // }

  return {
    classicAddress: wallet.address,
    walletType: walletType,
    seed: wallet.seed,
  };
}
