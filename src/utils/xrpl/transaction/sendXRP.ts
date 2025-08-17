import { client, connectXRPLClient } from "../testnet";
import { xrpToDrops } from "xrpl";
import * as xrpl from "xrpl";

// Type definitions
interface PaymentTransaction {
  TransactionType: "Payment";
  Account: string;
  Destination: string;
  Amount: string;
  DestinationTag?: number;
}

interface PaymentResponse {
  message: string;
}

interface XRPLResponse {
  result: {
    meta: {
      TransactionResult: string;
    };
    hash: string;
  };
}

// Error handling function with proper typing
const handlePaymentError = (errorCode: string, errorMessage: string = ""): never => {
  const errorMap: Record<string, string> = {
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

/**
 * Sends XRP from one account to another
 * 
 * @param senderWallet - The sender's XRPL wallet
 * @param destination - The destination account address
 * @param amount - The amount of XRP to send (as a number or string)
 * @param destinationTag - Optional destination tag for the payment
 * @returns Promise<PaymentResponse> - Success message with transaction details
 */
const sendXRP = async (
  senderWallet: xrpl.Wallet,
  destination: string,
  amount: string | number,
  destinationTag: number | null = null
): Promise<PaymentResponse> => {
  await connectXRPLClient();

  // Parse amount as float and convert to drops
  const amountInXRP = parseFloat(amount.toString());
  if (isNaN(amountInXRP) || amountInXRP <= 0) {
    throw new Error("Invalid XRP amount. Must be a positive number.");
  }

  const paymentTx: PaymentTransaction = {
    TransactionType: "Payment",
    Account: senderWallet.classicAddress,
    Destination: destination,
    Amount: xrpToDrops(amountInXRP.toString()),
    ...(destinationTag !== null &&
      destinationTag !== 0 && { DestinationTag: destinationTag }),
  };

  const preparedTx = await client.autofill(paymentTx);
  const signedTx = senderWallet.sign(preparedTx);
  const response = await client.submitAndWait(signedTx.tx_blob) as XRPLResponse;
  const resultCode = response.result.meta.TransactionResult;

  if (resultCode === "tesSUCCESS") {
    const msg = `Sender: ${senderWallet.classicAddress}
Recipient: ${destination}
Amount: ${amountInXRP} XRP
Transaction Hash: ${response.result.hash}
Destination Tag: ${destinationTag !== null && destinationTag !== 0 ? destinationTag : "N/A"}`;

    return {
      message: msg,
    };
  }
  
  handlePaymentError(resultCode, "Transaction failed");
};

export default sendXRP;
