import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { sendCrossCurrency } from "@/utils/xrpl/transaction/sendCrossCurrency";

export async function POST(req) {
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
    } = await req.json();

    if (
      !senderWallet ||
      !recipient ||
      !sendCurrency ||
      !sendAmount ||
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

    const result = await sendCrossCurrency(
      senderWallet,
      recipientAddress,
      sendCurrency,
      sendAmount,
      receiveCurrency,
      issuerAddress,
      slippagePercent ?? 5,
      destinationTag ?? null
    );

    return NextResponse.json({ 
      success: result.success,
      message: result.message,
     }, { status: 200 });
  } catch (error) {
    console.error("Error in /api/transactions/sendCrossCurrency:", error);
    return NextResponse.json(
      { error: `sendCrossCurrency failed: ${error.message}` },
      { status: 500 }
    );
  }
}
