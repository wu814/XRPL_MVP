// Change this file when there are more than 1 issuer wallet
import { client, connectXRPLClient } from "../testnet";
import { YONAWallet } from "@/types/appTypes";
import { Wallet, AccountLinesResponse, TrustSet } from "xrpl";
import sendIOU from "../transaction/sendIOU";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { SetLPTrustlineParams, SetTrustlineResult } from "@/types/xrpl/trustlineXRPLTypes";
import { isTypedTransactionSuccessful, handleTransactionError } from "../errorHandler";



interface WelcomeBonusAmounts {
  [key: string]: string;
}



export async function setTrustline(
  setterXRPLWallet: Wallet,
  issuerWalletAddress: string,
  currency: string,
  issuerWallets: YONAWallet[] | null = null,
): Promise<SetTrustlineResult> {
  try {
    await connectXRPLClient();
    const MAX_TRUST_LIMIT = "1000000000000000";

    // Check if trustline already exists before creating a new one
    const existingTrustline = await checkTrustline(
      setterXRPLWallet.classicAddress,
      issuerWalletAddress,
      currency,
    );

    if (existingTrustline) {
      console.log("ℹ️ Trustline already exists, skipping creation.");
      return {
        success: true,
        message: `Trustline already exists between ${setterXRPLWallet.classicAddress} and ${issuerWalletAddress} for ${currency}. No action needed.`,
      };
    }

    // Build the TrustSet transaction with the determined currency.
    const trustSetTx: TrustSet = {
      TransactionType: "TrustSet",
      Account: setterXRPLWallet.classicAddress,
      LimitAmount: {
        currency: currency,
        issuer: issuerWalletAddress,
        value: MAX_TRUST_LIMIT,
      },
    };

    const preparedTx = await client.autofill(trustSetTx);
    const signedTx = setterXRPLWallet.sign(preparedTx);
    const result = await client.submitAndWait<TrustSet>(signedTx.tx_blob);

    // Use the error handling helper functions
    if (!isTypedTransactionSuccessful(result)) {
      const errorInfo = handleTransactionError(result, "setTrustline");
      return {
        success: false,
        error: {
          code: errorInfo.code,
          message: errorInfo.message,
        },
      };
    }

    const trustlineMsg = `Trustline set from 
${setterXRPLWallet.classicAddress}
to 
${issuerWalletAddress} 
for ${currency}.`;

    // ***********************************************************
    // ONLY FOR DEMO PURPOSES
    // Send welcome IOU tokens based on fixed amounts table
    let bonusMsg = "";
    if (currency.length < 10) { // Only send welcome IOU tokens expect LP tokens
      const supabase = await createSupabaseAnonClient();
      const { data: walletData, error: walletError } = await supabase
        .from("wallets")
        .select("seed")
        .eq("classic_address", issuerWalletAddress)
        .single();

      if (walletError || !walletData?.seed) {
        throw new Error(`Failed to get issuer wallet seed: ${walletError?.message || 'No seed found'}`);
      }

      const issuerXRPLWallet = Wallet.fromSeed(walletData.seed);

      console.log(
        "✅ Trustline set successfully, now sending welcome IOU tokens...",
      );

      // Fixed amounts to send for each currency
      const WELCOME_BONUS_AMOUNTS: WelcomeBonusAmounts = {
        USD: "10000",
        ETH: "4",
        EUR: "8500",
        SOL: "65",
        BTC: "0.1",
      };

      
      try {
        if (issuerWallets && issuerWallets.length > 0) {
          // Get the fixed amount for this currency
          const welcomeAmount = WELCOME_BONUS_AMOUNTS[currency.toUpperCase()];

          if (welcomeAmount) {
            // Send IOU tokens based on fixed amount
            const iouResult = await sendIOU(
              issuerXRPLWallet, // issuer wallet is the sender
              setterXRPLWallet.classicAddress, // setter wallet is the recipient
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
        bonusMsg = `\n\n⚠️ Note: Trustline was set successfully, but welcome bonus could not be sent: ${iouError instanceof Error ? iouError.message : String(iouError)}`;
      }
      // ***********************************************************
    }
    return {
      success: true,
      message: trustlineMsg + bonusMsg,
    };

  } catch (error) {
    // Re-throw system errors with context
    throw new Error(`Failed to set trustline: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function checkTrustline(
  walletAddress: string, 
  destination: string, 
  currency: string
): Promise<boolean> {
  await connectXRPLClient();

  console.log(
    `🔍 Checking trustline for ${walletAddress} to ${destination} for ${currency}...`,
  );

  const trustlineResponse: AccountLinesResponse = await client.request({
    command: "account_lines",
    account: walletAddress,
    peer: destination,
  });

  const hasTrustline = trustlineResponse.result.lines.some(
    (line) => line.currency === currency,
  );

  if (hasTrustline) {
    console.log(
      `✅ Trustline exists between ${walletAddress} and ${destination} for ${currency}.`,
    );
    return true;
  } else {
    console.log(
      `ℹ️ No existing trustline found for ${currency}. Will need to set one up.`,
    );
    return false;
  }
}

export async function setLPTrustlineFromAMMData(
  { setterXRPLWallet, lpToken }: SetLPTrustlineParams,
): Promise<SetTrustlineResult | undefined> {
  await connectXRPLClient();

  if (!lpToken) {
    throw new Error("❌ LP token must be specified to set up LP trustline.");
  }

  console.log(
    `🔹 Setting up LP trustline for wallet ${setterXRPLWallet.classicAddress} to AMM ${lpToken.issuer}`,
  );

  const result = await setTrustline(
    setterXRPLWallet,
    lpToken.issuer,
    lpToken.currency,
  );

  if (!result?.success) {
    return {
      success: false,
      error: {
        code: result.error.code,
        message: result.error.message,
      },
    }
  }

  return {
    success: true,
    message: result.message,
  };
}
