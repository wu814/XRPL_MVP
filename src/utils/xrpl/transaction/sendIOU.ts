import { client, connectXrplClient } from "../testnet";
import BigNumber from "bignumber.js";
import * as xrpl from "xrpl";
import { YONAWallet } from "@/types/appTypes";

// Type definitions
interface IOUAmount {
  currency: string;
  issuer: string;
  value: string;
}

interface PaymentTransaction {
  TransactionType: "Payment";
  Account: string;
  Destination: string;
  Amount: IOUAmount;
  DestinationTag?: number;
  [key: string]: any; // Add index signature
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

interface AccountLinesResponse {
  result: {
    lines: Array<{
      currency: string;
      balance: string;
      account: string;
      [key: string]: any;
    }>;
  };
}

interface Trustline {
  currency: string;
  balance: string;
  account: string;
  [key: string]: any;
}

// Change this file when there are more than 1 issuer wallet

const handlePaymentError = (errorCode: string, errorMessage: string = ""): never => {
  const errorMap: Record<string, string> = {
    tecPATH_DRY:
      "Path dry: No sufficient liquidity or acceptable path was found for the payment. Make sure both the sender and recipient have trustlines to the issuer and that rippling is enabled on the issuer account.",

    tecNO_PATH:
      "No path found: There is no viable path between the sender and recipient for this IOU. Ensure both accounts have trustlines to the same issuer and sufficient liquidity exists.",

    tecNO_PERMISSION:
      "No permission: The transaction tried to use a trustline that doesn't allow rippling. Check if the trustline was set with the `noRipple` flag or if the issuer hasn't enabled rippling. Or recipient has lsfDepositAuth",

    tecDST_TAG_NEEDED:
      "Destination tag required: The destination account requires a destination tag to distinguish between incoming payments. Please provide a valid destination tag.",

    tecUNFUNDED_PAYMENT:
      "Unfunded payment: The sender does not have sufficient funds or the payment amount is zero. Check the balance and value being sent.",

    tecUNFUNDED_OFFER:
      "Unfunded offer: An offer involved in the transaction is unfunded. Ensure enough funds are available for the trade or transfer.",

    tecNO_ISSUER:
      "No issuer: The specified currency's issuer does not exist or does not match the trustline. Double-check the issuer address used in the transaction.",

    tecINSUFF_FEE:
      "Insufficient fee: The transaction fee is too low to be accepted by the network. Increase the fee to match the current load conditions.",

    tecEXPIRED:
      "Transaction expired: The transaction was submitted after its `LastLedgerSequence` was passed. Try resubmitting with an updated value.",

    tecFAILED_PROCESSING:
      "Unknown error: The transaction failed during processing. Inspect all fields and network conditions before retrying.",
  };

  const fallback = `Payment failed with code ${errorCode}: ${errorMessage || "Unknown error."}`;
  const error = errorMap[errorCode] || fallback;

  throw new Error(error);
};

const checkSenderBalance = async (
  senderWallet: xrpl.Wallet,
  issuerAddress: string,
  currency: string,
  amountString: string,
): Promise<void> => {
  const accountLines: AccountLinesResponse = await client.request({
    command: "account_lines",
    account: senderWallet.classicAddress,
    peer: issuerAddress,
  });

  const line: Trustline | undefined = accountLines.result.lines.find(
    (l) => l.currency === currency && l.account === issuerAddress,
  );
  if (!line)
    throw new Error(
      `Sender has no trust line with ${issuerAddress} for ${currency}`,
    );

  const available = new BigNumber(line.balance || 0);
  if (available.isLessThan(new BigNumber(amountString))) {
    throw new Error(
      `Insufficient balance: ${available.toString()} ${currency}, required: ${amountString}`,
    );
  }
};

const checkDestinationTrustline = async (
  destination: string,
  issuerAddress: string,
  currency: string,
): Promise<void> => {
  const accountLines: AccountLinesResponse = await client.request({
    command: "account_lines",
    account: destination,
    peer: issuerAddress,
  });
  const hasTrustline = accountLines.result.lines.some(
    (line) => line.currency === currency && line.account === issuerAddress,
  );
  if (!hasTrustline)
    console.warn(
      `⚠️ Destination ${destination} lacks trustline for ${currency}`,
    );
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
  senderWallet: xrpl.Wallet,
  destination: string,
  amount: string | number,
  currency: string,
  issuerWallets: YONAWallet[],
  destinationTag: number | null = null,
): Promise<PaymentResponse> => {
  await connectXrplClient();
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

  let payment: PaymentTransaction;

  if (senderIsIssuer) {
    // Case 1: Issuer sending IOU
    await checkDestinationTrustline(destination, issuerAddress, currency); 
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
      await checkSenderBalance(
        senderWallet,
        issuerAddress,
        currency,
        amountString,
      );
      await checkDestinationTrustline(destination, issuerAddress, currency); 
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

  const prepared = await client.autofill(payment as any);
  const signed = senderWallet.sign(prepared);
  const response = await client.submitAndWait(signed.tx_blob) as XRPLResponse;
  const resultCode = response.result.meta.TransactionResult;

  if (resultCode === "tesSUCCESS") {
    const msg = `Sender: ${senderAddress}
Recipient: ${destination}
Amount: ${amountString} ${currency}
Transaction Hash: ${response.result.hash}
Destination Tag: ${destinationTag !== null && destinationTag !== 0 ? destinationTag : "N/A"}`;

    return { message: msg };
  }

  handlePaymentError(resultCode, "Transaction failed");
};

export default sendIOU;
