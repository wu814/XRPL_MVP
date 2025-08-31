import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { sendCrossCurrency } from "@/utils/xrpl/transaction/sendCrossCurrency";
import { Wallet } from "xrpl";
import { SmartTradeAPIRequest, SmartTradeAPIResponse } from "@/types/api/smartAPITypes";
import { APIErrorResponse } from "@/types/api/errorAPITypes";

export async function POST(req: NextRequest): Promise<NextResponse<SmartTradeAPIResponse | APIErrorResponse>> {
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
    }: SmartTradeAPIRequest = await req.json();

    if (
      !senderWallet ||
      !sendCurrency ||
      (!sendAmount && !exactOutputAmount) ||
      !receiveCurrency ||
      !issuerAddress
    ) {
      return NextResponse.json<APIErrorResponse>(
        { message: "Missing required parameters" },
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
      return NextResponse.json<APIErrorResponse>(
        { message: "Wallet not found for the provided classicAddress" },
        { status: 404 },
      );
    }

    const senderXRPLWallet = Wallet.fromSeed(walletData.seed);

    const result = await sendCrossCurrency(
      senderXRPLWallet,
      recipientAddress,
      sendCurrency,
      sendAmount ?? undefined,
      receiveCurrency,
      issuerAddress,
      slippagePercent ?? 0,
      null,
      paymentType ?? "exact_input",
      exactOutputAmount ?? null
    );

    if (!result.success) {
      return NextResponse.json<APIErrorResponse>({ 
        message: result.message,
      }, { status: 400 });
    }

    return NextResponse.json<SmartTradeAPIResponse>({ 
      message: result.message,
     }, { status: 200 });
  } catch (error) {
    console.error("Error in /api/smart/smartTrade:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIErrorResponse>({ 
      message: `Smart trade failed: ${errorMessage}`,
    },
      { status: 500 }
    );
  }
}
