import { client, connectXrplClient } from "../testnet";
import * as xrpl from "xrpl";

export default async function createWallet(walletType) {
  await connectXrplClient();
  const fund_result = await client.fundWallet();
  const wallet = fund_result.wallet;

  return {
    classicAddress: wallet.address,
    walletType: walletType,
    seed: wallet.seed,
  };
}