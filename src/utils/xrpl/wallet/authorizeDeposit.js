import { client, connectXrplClient } from "../testnet";
import * as xrpl from "xrpl";

export default async function authorizeDeposit(
  treasuryWallet,
  authorizedAddress,
) {
  await connectXrplClient();

  const walletWithDepositAuth = xrpl.Wallet.fromSeed(treasuryWallet.seed);

  const dpTx = {
    TransactionType: "DepositPreauth",
    Account: walletWithDepositAuth.classicAddress,
    Authorize: authorizedAddress,
  };

  const prepared = await client.autofill(dpTx);
  const signed = walletWithDepositAuth.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  const txResult = result.result.meta.TransactionResult;
  if (txResult !== "tesSUCCESS") {
    throw new Error(`DepositPreauth failed: ${txResult}`);
  }

  const msg = `DepositPreauth successfully set for 
${authorizedAddress} 
to deposit to
${walletWithDepositAuth.classicAddress}`;
  return {
    message: msg,
  };
}
