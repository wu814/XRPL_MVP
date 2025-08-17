import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { sendCrossCurrency } from "@/utils/xrpl/transaction/sendCrossCurrency";
import { Wallet } from "xrpl";

interface SendCrossCurrencyRequest {
  senderWallet: {
    classicAddress: string;
  };
  recipient: string;
  sendCurrency: string;
  sendAmount?: string | number;
  receiveCurrency: string;
  issuerAddress: string;
  slippagePercent?: number;
  destinationTag?: number | null;
  useUsername?: boolean;
  paymentType?: "exact_input" | "exact_output";
  exactOutputAmount?: string | number;
}

export async function POST(req: NextRequest) {
  try {
    const {
      senderWallet,
      recipient,
      sendCurrency,
      sendAmount,
      receiveCurrency,
      issuerAddress,
      slippagePercent,
      destinationTag,
      useUsername,
      paymentType,
      exactOutputAmount,
    }: SendCrossCurrencyRequest = await req.json();

    if (
      !senderWallet ||
      !recipient ||
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

    let recipientAddress = recipient;

    if (useUsername) {
      const supabase = await createSupabaseAnonClient();
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("user_id")
        .eq("username", recipient)
        .single();

      if (userError || !userData) {
        throw new Error("User not found");
      }

      const { data: walletData, error: walletError } = await supabase
        .from("wallets")
        .select("classic_address")
        .eq("user_id", userData.user_id)
        .single();

      if (walletError || !walletData) {
        throw new Error("Receiver wallet not found");
      }

      recipientAddress = walletData.classic_address;
    }

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
      destinationTag: destinationTag ?? null,
      paymentType: paymentType ?? "exact_input",
      exactOutputAmount: exactOutputAmount ?? null
    });

    return NextResponse.json({ 
      success: result.success,
      message: result.message,
     }, { status: 200 });
  } catch (error) {
    console.error("Error in /api/transaction/sendCrossCurrency:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: `sendCrossCurrency failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
