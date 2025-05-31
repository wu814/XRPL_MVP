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

  const formatAsset = (type, value) => {
    return type === "XRP"
      ? xrpl.xrpToDrops(value.toString())
      : {
          currency: type,
          issuer: issuerWallet.classicAddress,
          value: value.toString(),
        };
  };

  const assetA = formatAsset(A, parsedAmountA);
  const assetB = formatAsset(B, parsedAmountB);

  const tx = {
    TransactionType: "AMMCreate",
    Account: standbyWallet.classicAddress,
    TradingFee: tradingFee,
    Amount: assetA,
    Amount2: assetB,
    Fee: "2000000",
    Flags: 0,
  };

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

  const formatForAmmInfo = (type, obj) =>
    type === "XRP"
      ? { currency: "XRP" }
      : { currency: obj.currency, issuer: obj.issuer };

  const ammInfo = await client.request({
    command: "amm_info",
    asset: formatForAmmInfo(A, assetA),
    asset2: formatForAmmInfo(B, assetB),
  });

  const amm = ammInfo.result?.amm;
  if (!amm) throw new Error("AMM not found in ledger after creation.");

  const poolKey = [A, B].sort().join("/");

  return {
    ammAddress: amm.account,
    pair: poolKey,
  };
}
