// Change this file when there are more than 1 issuer wallet
import { client, connectXrplClient } from "./testnet";
import * as xrpl from "xrpl";

export async function setTrustline(
  setterWallet,
  issuerWallets,
  currency,
) {
  await connectXrplClient();
  const MAX_TRUST_LIMIT = "1000000000"; // 1 billion of the currency

  // Build the TrustSet transaction with the determined currency.
  const trustSetTx = {
    TransactionType: "TrustSet",
    Account: setterWallet.classicAddress,
    LimitAmount: {
      currency: currency,
      issuer: issuerWallets[0].classicAddress,
      value: MAX_TRUST_LIMIT,
    },
    Flags: 131072, // tfSetNoRipple
  };

  const wallet = xrpl.Wallet.fromSeed(setterWallet.seed);
  const preparedTx = await client.autofill(trustSetTx);
  const signedTx = wallet.sign(preparedTx);
  const response = await client.submitAndWait(signedTx.tx_blob);

  if (response.result.meta.TransactionResult !== "tesSUCCESS") {
    throw new Error(
      `Setting trustline failed: ${response.result.meta.TransactionResult} [setTrustline.js]`
    );
  }
  const msg = `✅ Trustline setted from ${wallet.classicAddress} to ${issuerWallets[0].classicAddress} for ${currency}.`
  console.log(msg);

  return msg;
}
