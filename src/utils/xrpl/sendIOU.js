import { client, connectXrplClient } from "./testnet";
import * as xrpl from "xrpl";
import BigNumber from "bignumber.js";

const handlePaymentError = (errorCode, errorMessage = "") => {
  const errorMap = {
    tecPATH_DRY:
      "Path dry: No sufficient liquidity or acceptable path was found for the payment. Make sure both the sender and recipient have trustlines to the issuer and that rippling is enabled on the issuer account.",

    tecNO_PATH:
      "No path found: There is no viable path between the sender and recipient for this IOU. Ensure both accounts have trustlines to the same issuer and sufficient liquidity exists.",

    tecNO_PERMISSION:
      "No permission: The transaction tried to use a trustline that doesn't allow rippling. Check if the trustline was set with the `noRipple` flag or if the issuer hasn't enabled rippling.",

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


const checkSenderBalance = async (senderWallet, issuerAddress, currency, amountString) => {
  const { result: { lines } } = await client.request({
    command: "account_lines",
    account: senderWallet.classicAddress,
    peer: issuerAddress
  });

  const line = lines.find(l => l.currency === currency && l.account === issuerAddress);
  if (!line) throw new Error(`Sender has no trust line with ${issuerAddress} for ${currency}`);

  const available = new BigNumber(line.balance || 0);
  if (available.isLessThan(new BigNumber(amountString))) {
    throw new Error(`Insufficient balance: ${available.toString()} ${currency}, required: ${amountString}`);
  }
};

const checkDestinationTrustline = async (destination, issuerAddress, currency) => {
  const { result: { lines } } = await client.request({
    command: "account_lines",
    account: destination,
    peer: issuerAddress
  });

  const hasTrustline = lines.some(line => line.currency === currency && line.account === issuerAddress);
  if (!hasTrustline) console.warn(`⚠️ Destination ${destination} lacks trustline for ${currency}`);
};

const findBestPath = async (sender, destination, amountString, currency, issuerAddress) => {
  const { result } = await client.request({
    command: "ripple_path_find",
    source_account: sender,
    destination_account: destination,
    destination_amount: {
      currency,
      issuer: issuerAddress,
      value: amountString
    }
  });

  const alternative = result.alternatives?.[0];
  if (!alternative) return null;

  const sendMaxValue = new BigNumber(alternative.source_amount.value).multipliedBy(1.01).toString();
  const path = alternative.paths_computed || alternative.paths_canonical || alternative.paths || [[{ account: issuerAddress }]];

  return {
    SendMax: {
      currency: alternative.source_amount.currency,
      issuer: alternative.source_amount.issuer || issuerAddress,
      value: sendMaxValue
    },
    Paths: path
  };
};

const sendIOU = async (wallet, destination, amount, currency, issuerWallets, destinationTag = null) => {
  await connectXrplClient();
  const senderWallet = xrpl.Wallet.fromSeed(wallet.seed);
  const issuerAddress = issuerWallets[0].classicAddress;

  if (!senderWallet || !destination || !amount || !currency || !issuerAddress) {
    throw new Error("Missing required parameters for sendIOU");
  }

  const preciseAmount = new BigNumber(amount);
  if (!preciseAmount.isFinite() || preciseAmount.isLessThanOrEqualTo(0)) {
    throw new Error("Invalid amount format");
  }

  const amountString = preciseAmount.toString();
  const senderIsIssuer = senderWallet.classicAddress === issuerAddress;

  if (!senderIsIssuer) await checkSenderBalance(senderWallet, issuerAddress, currency, amountString);
  await checkDestinationTrustline(destination, issuerAddress, currency);

  let payment;
  if (senderIsIssuer) {
    payment = {
      TransactionType: "Payment",
      Account: senderWallet.classicAddress,
      Destination: destination,
      Amount: {
        currency,
        issuer: issuerAddress,
        value: amountString
      },
      ...(destinationTag != null && { DestinationTag: destinationTag })
    };
  } else {
    const pathData = await findBestPath(senderWallet.classicAddress, destination, amountString, currency, issuerAddress);
    if (!pathData || destination === issuerAddress) {
      payment = {
        TransactionType: "Payment",
        Account: senderWallet.classicAddress,
        Destination: destination,
        Amount: {
          currency,
          issuer: issuerAddress,
          value: amountString
        },
        // only add default path and SendMax if the destination is not the issuer and no pathData was found
        ...(destination !== issuerAddress && {
          Flags: 0x00010000 | 0x00020000,
          Paths: [[{ account: issuerAddress }]],
          SendMax: {
            currency,
            issuer: issuerAddress,
            value: preciseAmount.multipliedBy(1.5).toString()
          }
        }),
        ...(destinationTag != null && { DestinationTag: destinationTag })
      };
    } else {
      payment = {
        TransactionType: "Payment",
        Account: senderWallet.classicAddress,
        Destination: destination,
        Amount: {
          currency,
          issuer: issuerAddress,
          value: amountString
        },
        ...pathData,
        ...(destinationTag != null && { DestinationTag: destinationTag })
      };
    }
  }

  const prepared = await client.autofill(payment);
  const signed = senderWallet.sign(prepared);
  const response = await client.submitAndWait(signed.tx_blob);
  const resultCode = response.result.meta.TransactionResult;

  if (resultCode === "tesSUCCESS") {
    const msg = `Sender: ${senderWallet.classicAddress}
Recipient: ${destination}
Amount: ${amountString} ${currency}
Transaction Hash: ${response.result.hash}
Destination Tag: ${destinationTag !== null ? destinationTag : "N/A"}`;

    return {
      message: msg,
    };
  }

  handlePaymentError(resultCode, "Transaction failed");

};

export default sendIOU;
