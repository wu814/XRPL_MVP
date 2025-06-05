// Change this file when there are more than 1 issuer wallet
import { client, connectXrplClient } from "../testnet";
import * as xrpl from "xrpl";

export async function setTrustline(wallet, issuerWalletAddress, currency) {
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
      issuer: issuerWalletAddress,
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
${issuerWalletAddress} 
for ${currency}.`;

  return {
    success: true,
    message: msg,
  };
}

export async function checkTrustline(wallet, destination, currency) {
  await connectXrplClient();

  console.log(
    `🔍 Checking trustline for ${wallet.classicAddress} to ${destination} for ${currency}...`,
  );

  const trustlineResponse = await client.request({
    command: "account_lines",
    account: wallet.classicAddress,
    peer: destination,
  });

  const hasTrustline = trustlineResponse.result.lines.some(
    (line) => line.currency === currency,
  );

  if (hasTrustline) {
    console.log(
      `✅ Trustline exists between ${wallet.classicAddress} and ${destination} for ${currency}.`,
    );
    return true;
  } else {
    console.log(
      `ℹ️ No existing trustline found for ${currency}. Will need to set one up.`,
    );
    return false;
  }
}

export async function setLPTrustlineFromAMMData(providerWallet, ammData) {
  await connectXrplClient();

  const ammAccount = ammData.account;

  if (!ammAccount) {
    throw new Error("❌ AMM account must be specified to set up LP trustline.");
  }

  if (!ammData) {
    throw new Error(`❌ No AMM data found for account ${ammAccount}`);
  }

  if (
    !ammData.lp_token ||
    !ammData.lp_token.currency ||
    !ammData.lp_token.issuer
  ) {
    throw new Error("❌ Invalid LP token data in AMM data file.");
  }

  const lpToken = ammData.lp_token;

  console.log(
    `🔹 Setting up LP trustline for wallet ${providerWallet.classicAddress} to AMM ${ammAccount}`,
  );
  console.log(
    `🔹 LP Token details: Currency: ${lpToken.currency}, Issuer: ${lpToken.issuer}`,
  );

  const result = await setTrustline(
    providerWallet,
    lpToken.issuer,
    lpToken.currency,
  );

  if (result) {
    console.log("✅ LP Trustline successfully established.");
  } else {
    console.log("❌ Failed to establish LP trustline.");
  }

  return result;
}
