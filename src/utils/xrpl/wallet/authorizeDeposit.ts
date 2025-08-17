import { client, connectXRPLClient } from "../testnet";
import * as xrpl from "xrpl";

interface AuthorizeDepositResult {
  message: string;
}

/**
 * Authorize a specific address to deposit to a wallet with deposit auth
 * @param walletWithDepositAuth - Wallet that has deposit auth enabled
 * @param authorizedAddress - Address to authorize for deposits
 * @returns Success message
 */
export async function authorizeDeposit(
  walletWithDepositAuth: xrpl.Wallet,
  authorizedAddress: string,
): Promise<AuthorizeDepositResult> {
  await connectXRPLClient();

  const dpTx: xrpl.DepositPreauth = {
    TransactionType: "DepositPreauth",
    Account: walletWithDepositAuth.classicAddress,
    Authorize: authorizedAddress,
  };

  const prepared = await client.autofill(dpTx);
  const signed = walletWithDepositAuth.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  const txResult = (result.result.meta as any).TransactionResult;
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

export default authorizeDeposit;
