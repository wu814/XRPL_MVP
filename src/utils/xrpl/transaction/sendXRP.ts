import { client, connectXRPLClient } from "../testnet";
import { xrpToDrops, Wallet, Payment } from "xrpl";
import { SendXRPResult } from "@/types/xrpl/transactionXRPLTypes";
import { handleTransactionError, isTypedTransactionSuccessful } from "../errorHandler";

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
  senderWallet: Wallet,
  destination: string,
  amount: string | number,
  destinationTag: number | null = null
): Promise<SendXRPResult> => {
  await connectXRPLClient();

  // Parse amount as float and convert to drops
  const amountInXRP = parseFloat(amount.toString());
  if (isNaN(amountInXRP) || amountInXRP <= 0) {
    throw new Error("Invalid XRP amount. Must be a positive number.");
  }

  const paymentTx: Payment = {
    TransactionType: "Payment",
    Account: senderWallet.classicAddress,
    Destination: destination,
    Amount: xrpToDrops(amountInXRP.toString()),
    ...(destinationTag !== null &&
      destinationTag !== 0 && { DestinationTag: destinationTag }),
  };

  const preparedTx = await client.autofill(paymentTx);
  const signedTx = senderWallet.sign(preparedTx);
  const result = await client.submitAndWait<Payment>(signedTx.tx_blob);

  if (!isTypedTransactionSuccessful(result)) {
    const errorInfo = handleTransactionError(result, "sendXRP");
    return {
      success: false,
      message: errorInfo.message,
      error: errorInfo,
    };
  }

    const msg = `Sender: ${senderWallet.classicAddress}
Recipient: ${destination}
Amount: ${amountInXRP} XRP
Transaction Hash: ${result.result.hash}
Destination Tag: ${destinationTag !== null && destinationTag !== 0 ? destinationTag : "N/A"}`;

  return {
    success: true,
    message: msg,
  };
};

export default sendXRP;
