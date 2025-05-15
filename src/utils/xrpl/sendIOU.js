// Change this file when there are more than 1 issuer wallet

import { client, connectXrplClient } from "./testnet";
import * as xrpl from "xrpl";
import BigNumber from "bignumber.js";

const checkBalance = async (wallet, currency, issuerAddress, amountString) => {
  const accountLines = await client.request({
    command: "account_lines",
    account: wallet.classicAddress,
    peer: issuerAddress,
  });

  const trustLine = accountLines.result.lines.find(
    (line) => line.currency === currency && line.account === issuerAddress
  );

  if (!trustLine) {
    throw new Error(`Sender has no trustline with issuer(${issuerAddress}) for ${currency}`);
  }

  const available = new BigNumber(trustLine.balance || 0);
  if (available.isLessThan(new BigNumber(amountString))) {
    throw new Error(`Insufficient ${currency}: ${available.toString()} available, ${amountString} required.`);
  }
};

const checkDestinationTrustline = async (recipientAddress, currency, issuerAddress) => {
  try {
    const destLines = await client.request({
      command: "account_lines",
      account: recipientAddress,
      peer: issuerAddress,
    });

    const hasTrustline = destLines.result.lines.some(
      (line) => line.currency === currency && line.account === issuerAddress && line.limit > 0
    );

    if (!hasTrustline) {
      console.warn(`Destination ${recipientAddress} does not have trustline for ${currency}`);
    }
  } catch (err) {
    console.warn(`Unable to verify trustline for destination: ${err.message}`);
  }
};

const buildPaymentTx = (wallet, recipient, amount, currency, issuer, path = null, tag = null) => {
  const tx = {
    TransactionType: "Payment",
    Account: wallet.classicAddress,
    Destination: recipient,
    Amount: {
      currency,
      issuer,
      value: amount,
    },
  };

  if (path) tx.Paths = path;
  if (tag !== null && tag !== undefined) tx.DestinationTag = tag;

  return tx;
};

const handleRetry = async (payment, preciseAmount, currency, issuerAddress, recipient) => {
  const sendMax = preciseAmount.multipliedBy(1.05).toString();
  payment.SendMax = {
    currency,
    issuer: issuerAddress,
    value: sendMax,
  };

  const retryPrepared = await client.autofill(payment);
  const retrySigned = xrpl.Wallet.fromSeed(payment.Account).sign(retryPrepared);
  const retryResult = await client.submitAndWait(retrySigned.tx_blob);

  if (retryResult.result.meta.TransactionResult !== "tesSUCCESS") {
    throw new Error(`Retry failed: ${retryResult.result.meta.TransactionResult}`);
  }

  return {
    success: true,
    txId: retryResult.result.hash,
    amount: preciseAmount.toString(),
    currency,
    destination: recipient,
    ledgerIndex: retryResult.result.ledger_index,
  };
};

const sendIOU = async (wallet, recipient, amount, currency, issuerWallets, destinationTag = null) => {
  await connectXrplClient();

  const senderWallet = xrpl.Wallet.fromSeed(wallet.seed);
  const issuerAddress = issuerWallets[0].classicAddress;
  const preciseAmount = new BigNumber(amount);
  const amountString = preciseAmount.toString();

  const isIssuer = senderWallet.classicAddress === issuerAddress;
  if (!isIssuer) await checkBalance(senderWallet, currency, issuerAddress, amountString);

  await checkDestinationTrustline(recipient, currency, issuerAddress);

  let payment = buildPaymentTx(senderWallet, recipient, amountString, currency, issuerAddress, null, destinationTag);

  if (!isIssuer) {
    const pathResponse = await client.request({
      command: "ripple_path_find",
      source_account: senderWallet.classicAddress,
      destination_account: recipient,
      destination_amount: {
        currency,
        issuer: issuerAddress,
        value: amountString,
      },
    });

    const bestPath = pathResponse?.result?.alternatives?.[0]?.paths_computed;
    if (bestPath?.length) payment.Paths = bestPath;
  }

  const prepared = await client.autofill(payment);
  const signed = senderWallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  const code = result.result.meta.TransactionResult;
  if (code === "tesSUCCESS") {
    return {
      success: true,
      txId: result.result.hash,
      amount: amountString,
      currency,
      destination: recipient,
      ledgerIndex: result.result.ledger_index,
    };
  }

  if (code === "tecPATH_DRY") {
    console.warn("Path dry. Retrying with SendMax");
    return await handleRetry(payment, preciseAmount, currency, issuerAddress, recipient);
  }

  throw new Error(`XRPL Transaction failed: ${code}`);
};

export default sendIOU;
