import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import sendIOU from "@/utils/xrpl/transaction/sendIOU";

export async function POST(req) {
  try {
    const {
      senderWallet,
      recipient,
      amount,
      currency,
      issuerWallets,
      destinationTag,
      useUsername,
    } = await req.json();

    let recipientAddress;

    if (
      !senderWallet ||
      !recipient ||
      !amount ||
      !currency ||
      !issuerWallets
    ) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 },
      );
    }

    // If username is provided instead of address
    if (useUsername) {
      // fetching recipient's wallet address by username
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
  
      if (walletError || walletData.length === 0) {
        throw new Error("Receiver wallet not found");
      }
  
      recipientAddress = walletData.classic_address;
    } 
    // if an address is provided instead of a username
    else { 
      recipientAddress = recipient; 
    }

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
