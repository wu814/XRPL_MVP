import { client, connectXrplClient } from "../testnet";
import * as xrpl from "xrpl";

const handlePaymentError = (errorCode, errorMessage = "") => {
  const errorMap = {
    tecDST_TAG_NEEDED:
      "Destination tag required: The destination account requires a destination tag to distinguish incoming payments.",
    tecUNFUNDED_PAYMENT: "Unfunded payment: The sender has insufficient XRP.",
    tecINSUFF_FEE:
      "Insufficient fee: The transaction fee is too low. Increase the fee to reflect network load.",
    tecEXPIRED:
      "Transaction expired: The transaction was submitted after its `LastLedgerSequence` was passed. Try again with a higher value.",
    tecFAILED_PROCESSING:
      "Unknown error: The transaction failed during processing. Double-check the transaction format and values.",
  };

  const fallback = `Payment failed with code ${errorCode}: ${errorMessage || "Unknown error."}`;
  const error = errorMap[errorCode] || fallback;

  throw new Error(error);
};

const sendXRP = async (wallet, destination, amount, destinationTag = null) => {
  await connectXrplClient();

  // Recreate the sender wallet from the seed
  const senderWallet = xrpl.Wallet.fromSeed(wallet.seed);

  // Parse amount as float and convert to drops
  const amountInXRP = parseFloat(amount);
  if (isNaN(amountInXRP) || amountInXRP <= 0) {
    throw new Error("Invalid XRP amount. Must be a positive number.");
  }

  const paymentTx = {
    TransactionType: "Payment",
    Account: senderWallet.classicAddress,
    Destination: destination,
    Amount: xrpl.xrpToDrops(amountInXRP.toString()),
    ...(destinationTag !== null && destinationTag !== "" && { DestinationTag: destinationTag }),
  };

  const preparedTx = await client.autofill(paymentTx);
  const signedTx = senderWallet.sign(preparedTx);
  const response = await client.submitAndWait(signedTx.tx_blob);
  const resultCode = response.result.meta.TransactionResult;

  if (resultCode === "tesSUCCESS") {
    const msg = `Sender: ${senderWallet.classicAddress}
Recipient: ${destination}
Amount: ${amountInXRP} XRP
Transaction Hash: ${response.result.hash}
Destination Tag: ${(destinationTag !== null && destinationTag !== "") ? destinationTag : "N/A"}`;

    return {
      message: msg,
    };
  }
  handlePaymentError(resultCode, "Transaction failed");
};

export default sendXRP;
