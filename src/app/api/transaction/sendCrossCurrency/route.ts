import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { sendCrossCurrency } from "@/utils/xrpl/transaction/sendCrossCurrency";
import { Wallet } from "xrpl";
import { APIResponse, sendCrossCurrencyAPIRequest } from "@/types/apiTypes";


export async function POST(req: NextRequest): Promise<NextResponse<APIResponse<never>>> {
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
    }: sendCrossCurrencyAPIRequest = await req.json();

    if (
      !senderWallet ||
      !recipient ||
      !sendCurrency ||
      (!sendAmount && !exactOutputAmount) ||
      !receiveCurrency ||
      !issuerAddress
    ) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters" },
        { status: 400 }
      );
    }

    let recipientAddress = recipient;

    // Grab recipient's wallet address by username
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
        { success: false, message: "Wallet not found for the provided classicAddress" },
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
      destinationTag ?? null,
      paymentType ?? "exact_input",
      exactOutputAmount ?? null
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ 
      success: true,
      message: result.message,
     }, { status: 200 });
  } catch (error) {
    console.error("Error in /api/transaction/sendCrossCurrency:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { success: false, message: `sendCrossCurrency failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
