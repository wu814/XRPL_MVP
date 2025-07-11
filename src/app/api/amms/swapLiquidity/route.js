// This is calling the sendCrossCurrency function to swap liquidity between two currencies
// Recipient is the same as sender

import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { sendCrossCurrency } from "@/utils/xrpl/transaction/sendCrossCurrency";
import { Wallet } from "xrpl";

export async function POST(req) {
  try {
    const {
      senderWallet,
      sendCurrency,
      sendAmount,
      receiveCurrency,
      issuerAddress,
      slippagePercent,
      paymentType,
      exactOutputAmount,
    } = await req.json();

    if (
      !senderWallet ||
      !sendCurrency ||
      (!sendAmount && !exactOutputAmount) ||
      !receiveCurrency ||
      !issuerAddress
    ) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    let recipientAddress = senderWallet.classicAddress;

    const senderXrplWallet = Wallet.fromSeed(senderWallet.seed);

    console.log(sendCurrency, sendAmount, receiveCurrency, issuerAddress, slippagePercent, paymentType, exactOutputAmount);

    const result = await sendCrossCurrency(
      senderXrplWallet,
      recipientAddress,
      sendCurrency,
      sendAmount,
      receiveCurrency,
      issuerAddress,
      slippagePercent ?? 0,
      null, // destinationTag
      paymentType,
      exactOutputAmount ?? null
    );

    return NextResponse.json({ 
      success: result.success,
      message: result.message,
     }, { status: 200 });
  } catch (error) {
    console.error("Error in /api/amms/swapLiquidity:", error);
    return NextResponse.json(
      { error: `swapLiquidity failed: ${error.message}` },
      { status: 500 }
    );
  }
}
