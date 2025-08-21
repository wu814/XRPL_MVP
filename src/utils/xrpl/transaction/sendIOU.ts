import { client, connectXRPLClient } from "../testnet";
import BigNumber from "bignumber.js";
import { YONAWallet } from "@/types/appTypes";
import { SendIOUResult } from "@/types/xrpl/transactionXRPLTypes";
import { Payment, Wallet, AccountLinesResponse} from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../errorHandler";
import { checkTrustline } from "../trustline/setTrustline";

const checkSenderBalance = async (
  senderWallet: Wallet,
  issuerAddress: string,
  currency: string,
  amountString: string,
): Promise<SendIOUResult> => {
  const accountLines: AccountLinesResponse = await client.request({
    command: "account_lines",
    account: senderWallet.classicAddress,
    peer: issuerAddress,
  });

  const hasTrustline = await checkTrustline(senderWallet.classicAddress, issuerAddress, currency);
  if (!hasTrustline)
    return {
      success: false,
      message: `Sender has no trust line with ${issuerAddress} for ${currency}`,
      error: { code: "NO_TRUSTLINE", message: `Sender has no trust line with ${issuerAddress} for ${currency}` },
    };

  const available = new BigNumber(accountLines.result.lines.find(
    (l) => l.currency === currency && l.account === issuerAddress,
  )?.balance || 0);
  if (available.isLessThan(new BigNumber(amountString))) {
    return {
      success: false,
      message: `Insufficient balance: ${available.toString()} ${currency}, required: ${amountString}`,
      error: { code: "INSUFFICIENT_BALANCE", message: `Insufficient balance: ${available.toString()} ${currency}, required: ${amountString}` },
    };
  }

  return {
    success: true,
    message: `Sender has sufficient balance for IOU payment`,
    error: undefined,
  };
};

const checkDestinationTrustline = async (
  destination: string,
  issuerAddress: string,
  currency: string,
): Promise<SendIOUResult> => {
  const hasTrustline = await checkTrustline(destination, issuerAddress, currency);
  if (!hasTrustline)
    return {
      success: false,
      message: `Destination ${destination} lacks trustline for ${currency}`,
      error: { code: "NO_TRUSTLINE", message: `Destination ${destination} lacks trustline for ${currency}` },
    };

  return {
    success: true,
    message: `Destination ${destination} has trustline for ${currency}`,
    error: undefined,
  };
};

/**
 * Sends IOU tokens from one account to another
 * 
 * @param senderWallet - The sender's XRPL wallet
 * @param destination - The destination account address
 * @param amount - The amount of IOU tokens to send
 * @param currency - The currency code of the IOU tokens
 * @param issuerWallets - Array of issuer wallets (currently only first one is used)
 * @param destinationTag - Optional destination tag for the payment
 * @returns Promise<PaymentResponse> - Success message with transaction details
 */
const sendIOU = async (
  senderWallet: Wallet,
  destination: string,
  amount: string | number,
  currency: string,
  issuerWallets: YONAWallet[],
  destinationTag: number | null = null,
): Promise<SendIOUResult> => {
  await connectXRPLClient();
  const issuerAddress = issuerWallets[0].classicAddress;

  if (!senderWallet || !destination || !amount || !currency || !issuerAddress) {
    throw new Error("Missing required parameters for sendIOU");
  }

  const preciseAmount = new BigNumber(amount);
  if (!preciseAmount.isFinite() || preciseAmount.isLessThanOrEqualTo(0)) {
    throw new Error("Invalid amount format");
  }

  const amountString = preciseAmount.toString();
  const senderAddress = senderWallet.classicAddress;
  const senderIsIssuer = senderAddress === issuerAddress;

  let payment: Payment;

  if (senderIsIssuer) {
    // Case 1: Issuer sending IOU
    const destinationTrustlineResult = await checkDestinationTrustline(destination, issuerAddress, currency); 
    if (!destinationTrustlineResult.success) {
      return destinationTrustlineResult;
    }

    payment = {
      TransactionType: "Payment",
      Account: senderAddress,
      Destination: destination,
      Amount: {
        currency,
        issuer: issuerAddress,
        value: amountString,
      },
      ...(destinationTag != null && { DestinationTag: destinationTag }),
    };
  } else {
      // Case 2: Sender has IOU and enough balance
      const senderBalanceResult = await checkSenderBalance(
        senderWallet,
        issuerAddress,
        currency,
        amountString,
      );
      if (!senderBalanceResult.success) {
        return senderBalanceResult;
      }

      const destinationTrustlineResult = await checkDestinationTrustline(destination, issuerAddress, currency); 
      if (!destinationTrustlineResult.success) {
        return destinationTrustlineResult;
      }

      payment = {
        TransactionType: "Payment",
        Account: senderAddress,
        Destination: destination,
        Amount: {
          currency,
          issuer: issuerAddress,
          value: amountString,
        },
        ...(destinationTag != null && { DestinationTag: destinationTag }),
      };
  }

  const prepared = await client.autofill(payment);
  const signed = senderWallet.sign(prepared);
  const result = await client.submitAndWait<Payment>(signed.tx_blob);

  if(!isTypedTransactionSuccessful(result)) {
    const errorInfo = handleTransactionError(result, "sendIOU");
    return {
      success: false,
      message: errorInfo.message,
      error: errorInfo,
    };
  }

    const msg = `Sender: ${senderAddress}
Recipient: ${destination}
Amount: ${amountString} ${currency}
Transaction Hash: ${result.result.hash}
Destination Tag: ${destinationTag !== null && destinationTag !== 0 ? destinationTag : "N/A"}`;

  return {
    success: true,
    message: msg,
  };
};

export default sendIOU;
