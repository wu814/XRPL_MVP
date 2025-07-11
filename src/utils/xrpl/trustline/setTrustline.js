// Change this file when there are more than 1 issuer wallet
import { client, connectXrplClient } from "../testnet";
import { Wallet } from "xrpl";
import sendIOU from "../transaction/sendIOU";

export async function setTrustline(
  wallet,
  issuerWalletAddress,
  currency,
  issuerWallets = null,
) {
  await connectXrplClient();
  const MAX_TRUST_LIMIT = "1000000000000000";

  // Recreate the setter wallet from the seed.
  const setterWallet = Wallet.fromSeed(wallet.seed);

  // Check if trustline already exists before creating a new one
  const existingTrustline = await checkTrustline(setterWallet, issuerWalletAddress, currency);
  
  if (existingTrustline) {
    console.log("ℹ️ Trustline already exists, skipping creation.");
    return {
      success: true,
      message: `Trustline already exists between ${setterWallet.classicAddress} and ${issuerWalletAddress} for ${currency}. No action needed.`,
    };
  }

  // Build the TrustSet transaction with the determined currency.
  const trustSetTx = {
    TransactionType: "TrustSet",
    Account: setterWallet.classicAddress,
    LimitAmount: {
      currency: currency,
      issuer: issuerWalletAddress,
      value: MAX_TRUST_LIMIT,
    },
  };

  const preparedTx = await client.autofill(trustSetTx);
  const signedTx = setterWallet.sign(preparedTx);
  const response = await client.submitAndWait(signedTx.tx_blob);

  if (response.result.meta.TransactionResult !== "tesSUCCESS") {
    throw new Error(
      `Setting trustline failed: ${response.result.meta.TransactionResult} [setTrustline.js]`,
    );
  }

  const trustlineMsg = `Trustline set from 
${setterWallet.classicAddress}
to 
${issuerWalletAddress} 
for ${currency}.`;

  // ***********************************************************
  // ONLY FOR DEMO PURPOSES

  console.log(
    "✅ Trustline set successfully, now sending welcome IOU tokens...",
  );

  // Fixed amounts to send for each currency
  const WELCOME_BONUS_AMOUNTS = {
    USD: "10000",
    ETH: "4",
    EUR: "8500",
    SOL: "65",
    BTC: "0.1",
  };

  // Send welcome IOU tokens based on fixed amounts table
  let bonusMsg = "";
  try {
    if (issuerWallets && issuerWallets.length > 0) {
      // Get the fixed amount for this currency
      const welcomeAmount = WELCOME_BONUS_AMOUNTS[currency.toUpperCase()];

      if (welcomeAmount) {
        // Send IOU tokens based on fixed amount
        const iouResult = await sendIOU(
          issuerWallets[0], // issuer wallet is the sender
          setterWallet.classicAddress, // setter wallet is the recipient
          welcomeAmount,
          currency,
          issuerWallets,
          null, // no destination tag
        );

        console.log("✅ Welcome IOU tokens sent successfully!");

        bonusMsg = `\n\n🎉 Welcome bonus: ${welcomeAmount} ${currency} has been sent to your wallet!`;
      } else {
        console.log(`⚠️ No welcome bonus amount configured for ${currency}`);
        bonusMsg = `\n\n⚠️ Note: No welcome bonus configured for ${currency}`;
      }
    } else {
      console.log("⚠️ No issuer wallets provided, skipping welcome bonus");
    }
  } catch (iouError) {
    console.error("❌ Failed to send welcome IOU tokens:", iouError.message);
    bonusMsg = `\n\n⚠️ Note: Trustline was set successfully, but welcome bonus could not be sent: ${iouError.message}`;
  }
  // ***********************************************************
  return {
    success: true,
    message: trustlineMsg + bonusMsg,
  };
}

export async function checkTrustline(wallet, destination, currency) {
  await connectXrplClient();

  console.log(
    `🔍 Checking trustline for ${wallet.classicAddress} to ${destination} for ${currency}...`,
  );

  const trustlineResponse = await client.request({
    command: "account_lines",
    account: wallet.classicAddress,
    peer: destination,
  });

  const hasTrustline = trustlineResponse.result.lines.some(
    (line) => line.currency === currency,
  );

  if (hasTrustline) {
    console.log(
      `✅ Trustline exists between ${wallet.classicAddress} and ${destination} for ${currency}.`,
    );
    return true;
  } else {
    console.log(
      `ℹ️ No existing trustline found for ${currency}. Will need to set one up.`,
    );
    return false;
  }
}

export async function setLPTrustlineFromAMMData(providerWallet, ammData) {
  await connectXrplClient();

  const ammAccount = ammData.account;

  if (!ammAccount) {
    throw new Error("❌ AMM account must be specified to set up LP trustline.");
  }

  if (!ammData) {
    throw new Error(`❌ No AMM data found for account ${ammAccount}`);
  }

  if (
    !ammData.lp_token ||
    !ammData.lp_token.currency ||
    !ammData.lp_token.issuer
  ) {
    throw new Error("❌ Invalid LP token data in AMM data file.");
  }

  const lpToken = ammData.lp_token;

  console.log(
    `🔹 Setting up LP trustline for wallet ${providerWallet.classicAddress} to AMM ${ammAccount}`,
  );
  console.log(
    `🔹 LP Token details: Currency: ${lpToken.currency}, Issuer: ${lpToken.issuer}`,
  );

  const result = await setTrustline(
    providerWallet,
    lpToken.issuer,
    lpToken.currency,
  );

  if (result) {
    console.log("✅ LP Trustline successfully established.");
  } else {
    console.log("❌ Failed to establish LP trustline.");
  }

  return result;
}
