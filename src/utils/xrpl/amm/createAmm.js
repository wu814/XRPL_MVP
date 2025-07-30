import { client, connectXrplClient } from "../testnet";
import * as xrpl from "xrpl";

/**
 * Creates an AMM on the XRPL
 * @param {Object} creatorWallet - Treasury Wallet object with .seed
 * @param {Array} issuerWallets - Array of issuer wallet(s)
 * @param {string} assetAType - Asset A (e.g., XRP or token code)
 * @param {string | number} amountA - Amount for asset A
 * @param {string} assetBType - Asset B (e.g., USD, XRP)
 * @param {string | number} amountB - Amount for asset B
 * @param {number} tradingFee - Trading fee in basis points
 * @returns {Object} AMM metadata
 */
export default async function createAmm(
  creatorWallet,
  issuerWallets,
  assetAType,
  amountA,
  assetBType,
  amountB,
  fee,
) {
  await connectXrplClient();
  console.log("✅ Preparing AMM creation...");

  // Recreate the treasury wallet from the treasury wallet seed
  const treasuryWallet = xrpl.Wallet.fromSeed(creatorWallet.seed);
  const issuerWallet = issuerWallets?.[0];
  if (!issuerWallet) throw new Error("Missing issuer wallet.");

  const parsedAmountA = parseFloat(amountA);
  const parsedAmountB = parseFloat(amountB);
  const tradingFee = parseFloat(fee);

  if (isNaN(parsedAmountA) || parsedAmountA <= 0) {
    throw new Error("Invalid or missing amount for Asset A.");
  }
  if (isNaN(parsedAmountB) || parsedAmountB <= 0) {
    throw new Error("Invalid or missing amount for Asset B.");
  }

  // No need to uppercase, assume assetAType and assetBType are already uppercase currency codes
  const A = assetAType;
  const B = assetBType;

  // Sort currencies alphabetically to ensure consistent ordering
  const currencies = [A, B].sort();

  // Prepare assets for transaction
  const assetA = A === "XRP"
    ? xrpl.xrpToDrops(parsedAmountA.toString())
    : {
        currency: A,
        issuer: issuerWallet.classicAddress,
        value: parsedAmountA.toString(),
      };

  const assetB = B === "XRP"
    ? xrpl.xrpToDrops(parsedAmountB.toString())
    : {
        currency: B,
        issuer: issuerWallet.classicAddress,
        value: parsedAmountB.toString(),
      };

  // change the fee (in drops) to create AMM
  const tx = {
    TransactionType: "AMMCreate",
    Account: treasuryWallet.classicAddress,
    TradingFee: tradingFee,
    Amount: assetA,
    Amount2: assetB,
    Fee: "2000000",
    Flags: 0,
  };

  console.log("📜 AMM Create transaction:", JSON.stringify(tx, null, 2));

  const preparedTx = await client.autofill(tx);
  preparedTx.Fee = "2000000";
  preparedTx.LastLedgerSequence += 50;

  // Submit the transaction
  const signedTx = treasuryWallet.sign(preparedTx);
  const submission = await client.submitAndWait(signedTx.tx_blob);

  const resultCode = submission.result.meta.TransactionResult;
  if (resultCode !== "tesSUCCESS") {
    throw new Error(`AMM creation failed with code: ${resultCode}`);
  }
  console.log("✅ AMM created successfully!");

  // Fetch the AMM account from the ledger using the asset pair
  const ammInfoResponse = await client.request({
    command: "amm_info",
    asset: A === "XRP" ? { currency: "XRP" } : { currency: A, issuer: issuerWallet.classicAddress },
    asset2: B === "XRP" ? { currency: "XRP" } : { currency: B, issuer: issuerWallet.classicAddress },
    ledger_index: "validated",
  });

  if (!ammInfoResponse.result.amm || !ammInfoResponse.result.amm.account) {
    throw new Error("Could not find AMM account after creation.");
  }

  // Return the actual AMM account ID
  return {
    ammAccount: ammInfoResponse.result.amm.account,
    currency_a: currencies[0],
    currency_b: currencies[1],
  };
}
