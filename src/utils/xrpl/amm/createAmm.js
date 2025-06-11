import { client, connectXrplClient } from "../testnet";
import * as xrpl from "xrpl";

/**
 * Creates an AMM on the XRPL
 * @param {Object} treasuryWallet - Wallet object with .seed
 * @param {Array} issuerWallets - Array of issuer wallet(s)
 * @param {string} assetAType - Asset A (e.g., XRP or token code)
 * @param {string | number} amountA - Amount for asset A
 * @param {string} assetBType - Asset B (e.g., USD, XRP)
 * @param {string | number} amountB - Amount for asset B
 * @param {number} tradingFee - Trading fee in basis points
 * @returns {Object} AMM metadata
 */
export default async function createAmm(
  treasuryWallet,
  issuerWallets,
  assetAType,
  amountA,
  assetBType,
  amountB,
  fee,
) {
  await connectXrplClient();
  console.log("✅ Preparing AMM creation...");

  // Recreate the standby wallet from the treasury wallet seed
  const standbyWallet = xrpl.Wallet.fromSeed(treasuryWallet.seed);
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

  const A = assetAType.toUpperCase();
  const B = assetBType.toUpperCase();

  // Unified function to format assets for both XRPL transactions and database storage
  const formatAsset = (type, value, forTransaction = true) => {
    if (type === "XRP") {
      return forTransaction
        ? xrpl.xrpToDrops(value.toString())
        : { currency: "XRP", value: value.toString() };
    } else {
      return forTransaction
        ? {
            currency: type,
            issuer: issuerWallet.classicAddress,
            value: value.toString(),
          }
        : {
            currency: type,
            issuer: issuerWallet.classicAddress,
            value: value.toString(),
          };
    }
  };

  // Sort currencies alphabetically to ensure consistent ordering
  const currencies = [
    { type: A, amount: parsedAmountA },
    { type: B, amount: parsedAmountB },
  ].sort((a, b) => a.type.localeCompare(b.type));

  const assetA = formatAsset(currencies[0].type, currencies[0].amount, true);
  const assetB = formatAsset(currencies[1].type, currencies[1].amount, true);

  // change the fee (in drops) to create AMM
  const tx = {
    TransactionType: "AMMCreate",
    Account: standbyWallet.classicAddress,
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

  const signedTx = standbyWallet.sign(preparedTx);
  const submission = await client.submitAndWait(signedTx.tx_blob);

  const resultCode = submission.result.meta.TransactionResult;
  if (resultCode !== "tesSUCCESS") {
    throw new Error(`AMM creation failed with code: ${resultCode}`);
  }
  console.log("✅ AMM created successfully!");

  const formatForAmmInfo = (type) => {
    if (type === "XRP") {
      return { currency: "XRP" };
    } else {
      // For non-XRP assets, use the original type and issuer wallet
      return { 
        currency: type, 
        issuer: issuerWallet.classicAddress 
      };
    }
  };

  const ammInfo = await client.request({
    command: "amm_info",
    asset: formatForAmmInfo(A),
    asset2: formatForAmmInfo(B),
  });

  const amm = ammInfo.result?.amm;
  if (!amm) throw new Error("AMM not found in ledger after creation.");

  return {
    ammAccount: amm.account,
    currency_a: formatAsset(currencies[0].type, currencies[0].amount, false),
    currency_b: formatAsset(currencies[1].type, currencies[1].amount, false),
  };
}
