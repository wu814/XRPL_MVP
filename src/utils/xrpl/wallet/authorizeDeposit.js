import { client, connectXrplClient } from "../testnet";

export default async function authorizeDeposit(
  walletWithDepositAuth,
  authorizedAddress,
) {
  await connectXrplClient();

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