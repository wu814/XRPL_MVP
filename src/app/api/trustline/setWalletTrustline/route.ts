import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";
import BigNumber from "bignumber.js";

import {
  setTrustline,
  checkTrustline,
} from "@/utils/xrpl/trustline/setTrustline";
import sendIOU from "@/utils/xrpl/transaction/sendIOU";
import { authorizeTrustline } from "@/utils/xrpl/trustline/authorizeTrustline";
import { getLivePriceUSD } from "@/utils/xrpl/oracle/getLivePriceUSD";
import { client, connectXRPLClient } from "@/utils/xrpl/testnet";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { Wallet } from "xrpl";
import {
  APIResponse,
  SetWalletTrustlineAPIRequest,
  SetWalletTrustlineAPIData,
  WelcomeBonusInfo,
} from "@/types/apiTypes";
import { YONAWallet } from "@/types/appTypes";

const WELCOME_BONUS_USD = 1000;

/** asfRequireAuth on AccountRoot — issuer must authorize holders before receiving issued currency */
async function issuerAccountRequiresAuth(issuerClassicAddress: string): Promise<boolean> {
  await connectXRPLClient();
  const issuerAccountInfo = await client.request({
    command: "account_info",
    account: issuerClassicAddress,
    ledger_index: "validated",
  });
  const issuerFlags = Number(issuerAccountInfo.result.account_data.Flags);
  return (issuerFlags & 0x00040000) !== 0;
}

export async function POST(
  req: NextRequest,
): Promise<NextResponse<APIResponse<SetWalletTrustlineAPIData>>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.user_id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { setterWallet, issuerWallets, currency }: SetWalletTrustlineAPIRequest = await req.json();

    if (!setterWallet) {
      return NextResponse.json({ success: false, message: "Missing setterWallet" }, { status: 400 });
    }
    if (!issuerWallets?.[0]?.classicAddress) {
      return NextResponse.json({ success: false, message: "Missing issuerWallets" }, { status: 400 });
    }
    if (!currency) {
      return NextResponse.json({ success: false, message: "Missing currency" }, { status: 400 });
    }

    const issuerAddress = issuerWallets[0].classicAddress;

    const supabase = await createSupabaseAnonClient();
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", setterWallet.classicAddress)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json(
        { success: false, message: "Wallet not found for the provided classicAddress" },
        { status: 404 },
      );
    }

    const setterXRPLWallet = Wallet.fromSeed(walletData.seed);

    // Pre-check so we know whether to award the welcome bonus.
    const trustlineAlreadyExisted = await checkTrustline(
      setterXRPLWallet.classicAddress,
      issuerAddress,
      currency,
    );

    if (trustlineAlreadyExisted) {
      return NextResponse.json(
        {
          success: true,
          message: `Trustline already exists between ${setterXRPLWallet.classicAddress} and ${issuerAddress} for ${currency}. No action needed.`,
          data: { trustlineAlreadyExisted: true },
        },
        { status: 200 },
      );
    }

    const result = await setTrustline(
      setterXRPLWallet,
      issuerAddress,
      currency,
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 500 },
      );
    }

    const welcomeBonus = await awardWelcomeBonus({
      recipientAddress: setterXRPLWallet.classicAddress,
      issuerWallets,
      currency,
    });

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        data: {
          trustlineAlreadyExisted: false,
          welcomeBonus,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return NextResponse.json(
      { success: false, message: `Trustline setup failed: ${errorMessage}` },
      { status: 500 },
    );
  }
}

/**
 * Issues the first-time welcome bonus from the issuer wallet to the user.
 * Never throws — on any failure it returns a `skipped` bonus so the caller
 * can still report the trustline as successfully set.
 */
async function awardWelcomeBonus(params: {
  recipientAddress: string;
  issuerWallets: YONAWallet[];
  currency: string;
}): Promise<WelcomeBonusInfo> {
  const { recipientAddress, issuerWallets, currency } = params;
  const issuerAddress = issuerWallets[0].classicAddress;

  const skipped = (reason: string): WelcomeBonusInfo => ({
    currency,
    amount: "0",
    usdValue: WELCOME_BONUS_USD,
    pricePerUnitUSD: 0,
    skipped: true,
    skipReason: reason,
  });

  try {
    const priceResult = await getLivePriceUSD(currency);
    if (!priceResult.available || priceResult.price <= 0) {
      return skipped(
        priceResult.reason || `Live USD price for ${currency} is unavailable`,
      );
    }

    const amountBN = new BigNumber(WELCOME_BONUS_USD).dividedBy(
      priceResult.price,
    );
    if (!amountBN.isFinite() || amountBN.isLessThanOrEqualTo(0)) {
      return skipped(`Computed bonus amount is invalid for ${currency}`);
    }

    // Round down to 6 decimals: comfortably within XRPL IOU precision while
    // keeping the display number tidy.
    const amountString = amountBN
      .decimalPlaces(6, BigNumber.ROUND_DOWN)
      .toString();

    const supabase = await createSupabaseAnonClient();
    const { data: issuerRow, error: issuerError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", issuerAddress)
      .single();

    if (issuerError || !issuerRow?.seed) {
      return skipped("Issuer wallet seed not available");
    }

    const issuerXRPLWallet = Wallet.fromSeed(issuerRow.seed);

    if (await issuerAccountRequiresAuth(issuerAddress)) {
      const authResult = await authorizeTrustline(
        issuerXRPLWallet,
        recipientAddress,
        currency,
      );
      if (!authResult.success) {
        return skipped(
          `Issuer authorization failed (required before welcome gift): ${authResult.message}`,
        );
      }
    }

    const sendResult = await sendIOU(
      issuerXRPLWallet,
      recipientAddress,
      amountString,
      currency,
      issuerWallets,
    );

    if (!sendResult.success) {
      return skipped(sendResult.message);
    }

    const hashMatch = sendResult.message.match(/Transaction Hash:\s*([A-F0-9]+)/i);

    return {
      currency,
      amount: amountString,
      usdValue: WELCOME_BONUS_USD,
      pricePerUnitUSD: priceResult.price,
      transactionHash: hashMatch?.[1],
      skipped: false,
    };
  } catch (err) {
    return skipped(
      err instanceof Error
        ? err.message
        : "Unknown error while issuing welcome bonus",
    );
  }
}
