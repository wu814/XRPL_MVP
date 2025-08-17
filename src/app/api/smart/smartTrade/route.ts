import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { sendCrossCurrency } from "@/utils/xrpl/transaction/sendCrossCurrency";
import { Wallet } from "xrpl";

interface SmartTradeRequest {
  senderWallet: {
    classicAddress: string;
  };
  sendCurrency: string;
  sendAmount?: string | number;
  receiveCurrency: string;
  issuerAddress: string;
  slippagePercent?: number;
  paymentType?: "exact_input" | "exact_output";
  exactOutputAmount?: string | number;
}

export async function POST(req: NextRequest) {
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
    }: SmartTradeRequest = await req.json();

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

    // Get seed from Supabase using classicAddress
    const supabase = await createSupabaseAnonClient();
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", senderWallet.classicAddress)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json(
        { error: "Wallet not found for the provided classicAddress" },
        { status: 404 },
      );
    }

    const senderXRPLWallet = Wallet.fromSeed(walletData.seed);

    const result = await sendCrossCurrency({
      senderWallet: senderXRPLWallet,
      destinationAddress: recipientAddress,
      sendCurrency,
      sendAmount: sendAmount ?? undefined,
      receiveCurrency,
      issuerAddress,
      slippagePercent: slippagePercent ?? 0,
      destinationTag: null,
      paymentType: paymentType ?? "exact_input",
      exactOutputAmount: exactOutputAmount ?? null
    });

    return NextResponse.json({ 
      success: result.success,
      message: result.message,
     }, { status: 200 });
  } catch (error) {
    console.error("Error in /api/smart/smartTrade:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: `Smart trade failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
