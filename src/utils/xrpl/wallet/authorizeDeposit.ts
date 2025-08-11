import { client, connectXrplClient } from "../testnet";
import * as xrpl from "xrpl";

interface AuthorizeDepositResult {
  message: string;
}

/**
 * Authorize deposit for an account
 * @param wallet - XRPL wallet instance
 * @param authorizedAddress - Address to authorize for deposits
 * @returns Success message
 */
export async function authorizeDeposit(
  wallet: xrpl.Wallet, 
  authorizedAddress: string
): Promise<AuthorizeDepositResult> {
  await connectXrplClient();

  const setFlagsTx: xrpl.AccountSet = {
    TransactionType: "AccountSet",
    Account: wallet.classicAddress,
    SetFlag: xrpl.AccountSetAsfFlags.asfDepositAuth,
  };

  const prepared = await client.autofill(setFlagsTx);
  const signed = wallet.sign(prepared);
  await client.submitAndWait(signed.tx_blob);

  return { message: "Deposit authorization set successfully" };
}

export default authorizeDeposit;
