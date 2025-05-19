// Change this file when there are more than 1 issuer wallet
import { client, connectXrplClient } from "../testnet";
import * as xrpl from "xrpl";

export default async function setTrustline(wallet, issuerWallets, currency) {
  await connectXrplClient();
  const MAX_TRUST_LIMIT = "1000000000000000";
  
  // Recreate the setter wallet from the seed.
  const setterWallet = xrpl.Wallet.fromSeed(wallet.seed);

  // Build the TrustSet transaction with the determined currency.
  const trustSetTx = {
    TransactionType: "TrustSet",
    Account: setterWallet.classicAddress,
    LimitAmount: {
      currency: currency,
      issuer: issuerWallets[0].classicAddress,
      value: MAX_TRUST_LIMIT,
    },
  };

  const preparedTx = await client.autofill(trustSetTx);
  const signedTx = setterWallet.sign(preparedTx);
  const response = await client.submitAndWait(signedTx.tx_blob);

  if (response.result.meta.TransactionResult !== "tesSUCCESS") {
    throw new Error(
      `Setting trustline failed: ${response.result.meta.TransactionResult} [setTrustline.js]`,
    );
  }
  const msg = `Trustline set from 
${setterWallet.classicAddress}
to 
${issuerWallets[0].classicAddress} 
for ${currency}.`;

  return {
    message: msg,
  }
}
