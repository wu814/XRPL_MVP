import { client, connectXrplClient } from "./testnet";
import * as xrpl from "xrpl";

const sendXRP = async (wallet, recipientAddress, amount) => {
  await connectXrplClient();
  const senderWallet = xrpl.Wallet.fromSeed(wallet.seed);
  console.log(`🔹 Sending ${amount} XRP from ${senderWallet.classicAddress} to ${recipientAddress}...`);

  // Parse amount as float and convert to drops
  const amountInXRP = parseFloat(amount);
  if (isNaN(amountInXRP) || amountInXRP <= 0) {
    throw new Error("Invalid XRP amount. Must be a positive number.");
  }

  const paymentTx = {
    TransactionType: "Payment",
    Account: senderWallet.classicAddress,
    Destination: recipientAddress,
    Amount: xrpl.xrpToDrops(amountInXRP.toString())
  };

  console.log(`🔹 Payment details: ${JSON.stringify(paymentTx, null, 2)}`);

  const preparedTx = await client.autofill(paymentTx);
  const signedTx = senderWallet.sign(preparedTx);
  const response = await client.submitAndWait(signedTx.tx_blob);

  if (response.result.meta.TransactionResult === "tesSUCCESS") {
    console.log(`✅ Successfully sent ${amountInXRP} XRP to ${recipientAddress}`);
    return {
      success: true,
      txId: response.result.hash,
      currency: "XRP",
      amount: amountInXRP
    };
  } else {
    const errorMsg = `Transaction failed: ${response.result.meta.TransactionResult}`;
    throw new Error(errorMsg);
  }
};

export default sendXRP;
