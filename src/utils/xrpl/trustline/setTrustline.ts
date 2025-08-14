// Change this file when there are more than 1 issuer wallet
import { client, connectXrplClient } from "../testnet";
import { YONAWallet } from "@/types/appTypes";
import { Wallet } from "xrpl";
import sendIOU from "../transaction/sendIOU";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

// Type definitions
interface TrustlineResult {
  success: boolean;
  message: string;
}

interface AMMData {
  amm_account: string;
  lp_token: {
    currency: string;
    issuer: string;
  };
}

interface WelcomeBonusAmounts {
  [key: string]: string;
}

interface TrustlineResponse {
  result: {
    lines: Array<{
      currency: string;
      [key: string]: any;
    }>;
  };
}

export async function setTrustline(
  setterXrplWallet: Wallet,
  issuerWalletAddress: string,
  currency: string,
  issuerWallets: YONAWallet[] | null = null,
): Promise<TrustlineResult> {
  await connectXrplClient();
  const MAX_TRUST_LIMIT = "1000000000000000";

  // Check if trustline already exists before creating a new one
  const existingTrustline = await checkTrustline(
    setterXrplWallet,
    issuerWalletAddress,
    currency,
  );

  if (existingTrustline) {
    console.log("ℹ️ Trustline already exists, skipping creation.");
    return {
      success: true,
      message: `Trustline already exists between ${setterXrplWallet.classicAddress} and ${issuerWalletAddress} for ${currency}. No action needed.`,
    };
  }

  // Build the TrustSet transaction with the determined currency.
  const trustSetTx = {
    TransactionType: "TrustSet" as const,
    Account: setterXrplWallet.classicAddress,
    LimitAmount: {
      currency: currency,
      issuer: issuerWalletAddress,
      value: MAX_TRUST_LIMIT,
    },
  };

  const preparedTx = await client.autofill(trustSetTx);
  const signedTx = setterXrplWallet.sign(preparedTx);
  const response = await client.submitAndWait(signedTx.tx_blob);

  if ((response.result.meta as any).TransactionResult !== "tesSUCCESS") {
    throw new Error(
      `Setting trustline failed: ${(response.result.meta as any).TransactionResult} [setTrustline.ts]`,
    );
  }

  const trustlineMsg = `Trustline set from 
${setterXrplWallet.classicAddress}
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

    const issuerXrplWallet = Wallet.fromSeed(walletData.seed);

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
            issuerXrplWallet, // issuer wallet is the sender
            setterXrplWallet.classicAddress, // setter wallet is the recipient
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
      console.error("❌ Failed to send welcome IOU tokens:", iouError instanceof Error ? iouError.message : String(iouError));
      bonusMsg = `\n\n⚠️ Note: Trustline was set successfully, but welcome bonus could not be sent: ${iouError instanceof Error ? iouError.message : String(iouError)}`;
    }
    // ***********************************************************
  }
  return {
    success: true,
    message: trustlineMsg + bonusMsg,
  };
}

export async function checkTrustline(
  wallet: Wallet, 
  destination: string, 
  currency: string
): Promise<boolean> {
  await connectXrplClient();

  console.log(
    `🔍 Checking trustline for ${wallet.classicAddress} to ${destination} for ${currency}...`,
  );

  const trustlineResponse: TrustlineResponse = await client.request({
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

export async function setLPTrustlineFromAMMData(
  providerWallet: Wallet, 
  ammData: AMMData
): Promise<TrustlineResult | undefined> {
  await connectXrplClient();

  const ammAccount = ammData.amm_account;

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
