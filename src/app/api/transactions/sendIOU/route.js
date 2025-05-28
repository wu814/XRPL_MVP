import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import sendIOU from "@/utils/xrpl/transaction/sendIOU";

export async function POST(req) {
  try {
    const {
      senderWallet,
      recipientUsername,
      amount,
      currency,
      issuerWallets,
      destinationTag,
    } = await req.json();

    if (
      !senderWallet ||
      !recipientUsername ||
      !amount ||
      !currency ||
      !issuerWallets
    ) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 },
      );
    }

    
    // fetching recipient's wallet address by username
    const supabase = await createSupabaseAnonClient();
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("user_id")
      .eq("username", recipientUsername)
      .single();

    if (userError || !userData) {
      throw new Error("User not found");
    }

    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("classic_address")
      .eq("user_id", userData.user_id)
      .single();

    if (walletError || walletData.length === 0) {
      throw new Error("Wallet not found");
    }

    const recipientAddress = walletData.classic_address;

    const result = await sendIOU(
      senderWallet,
      recipientAddress,
      amount,
      currency,
      issuerWallets,
      destinationTag ?? null,
    );

    return NextResponse.json({ message: result.message }, { status: 200 });
  } catch (error) {
    console.error("Error in /api/transactions/sendIOU:", error);
    return NextResponse.json(
      { error: `sendIOU failed: ${error.message}` },
      { status: 500 },
    );
  }
}
