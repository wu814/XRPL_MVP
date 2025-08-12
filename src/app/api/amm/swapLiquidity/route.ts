import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { sendCrossCurrency } from "@/utils/xrpl/transaction/sendCrossCurrency";
import { Wallet } from "xrpl";

interface SwapLiquidityRequest {
  senderWallet: {
    classicAddress: string;
  };
  sendCurrency: string;
  sendAmount?: string;
  receiveCurrency: string;
  issuerAddress: string;
  slippagePercent?: number;
  paymentType?: "exact_input" | "exact_output";
  exactOutputAmount?: string;
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
    }: SwapLiquidityRequest = await req.json();

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

    const recipientAddress = senderWallet.classicAddress;

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

    const senderXrplWallet: Wallet = Wallet.fromSeed(walletData.seed);

    const result = await sendCrossCurrency({
      senderWallet: senderXrplWallet,
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
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in /api/amm/swapLiquidity:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: `swapLiquidity failed: ${errorMessage}` },
      { status: 500 },
    );
  }
}
