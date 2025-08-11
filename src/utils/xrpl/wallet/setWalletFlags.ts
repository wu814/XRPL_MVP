import { client, connectXrplClient } from "../testnet";
import * as xrpl from "xrpl";

/**
 * Set flags for issuer wallet
 * @param wallet - XRPL wallet instance
 */
export async function setIssuerWalletFlags(wallet: xrpl.Wallet): Promise<void> {
  await connectXrplClient();

  const setFlagsTx: xrpl.AccountSet = {
    TransactionType: "AccountSet",
    Account: wallet.classicAddress,
    SetFlag: xrpl.AccountSetAsfFlags.asfDefaultRipple,
  };

  const prepared = await client.autofill(setFlagsTx);
  const signed = wallet.sign(prepared);
  await client.submitAndWait(signed.tx_blob);
}

/**
 * Set flags for treasury wallet
 * @param wallet - XRPL wallet instance
 */
export async function setTreasuryWalletFlags(wallet: xrpl.Wallet): Promise<void> {
  await connectXrplClient();

  const setFlagsTx: xrpl.AccountSet = {
    TransactionType: "AccountSet",
    Account: wallet.classicAddress,
    SetFlag: xrpl.AccountSetAsfFlags.asfDepositAuth,
  };

  const prepared = await client.autofill(setFlagsTx);
  const signed = wallet.sign(prepared);
  await client.submitAndWait(signed.tx_blob);
}

/**
 * Set flags for pathfind wallet
 * @param wallet - XRPL wallet instance
 */
export async function setPathfindWalletFlags(wallet: xrpl.Wallet): Promise<void> {
  await connectXrplClient();

  const setFlagsTx: xrpl.AccountSet = {
    TransactionType: "AccountSet",
    Account: wallet.classicAddress,
    SetFlag: xrpl.AccountSetAsfFlags.asfDefaultRipple,
  };

  const prepared = await client.autofill(setFlagsTx);
  const signed = wallet.sign(prepared);
  await client.submitAndWait(signed.tx_blob);
}
