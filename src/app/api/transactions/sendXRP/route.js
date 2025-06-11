import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import sendXRP from "@/utils/xrpl/transaction/sendXRP";

export async function POST(req) {
  try {
    const { senderWallet, recipientUsername, recipientAddress, recipient, amount, destinationTag, useUsername } =
      await req.json();

    if (!senderWallet || !amount) {
      return NextResponse.json(
        { error: "Missing required parameters: senderWallet and amount are required" },
        { status: 400 },
      );
    }

    let recipientAddressFinal;

    // Handle both username and direct address transfers
    if (useUsername || recipientUsername) {
      // Username-based transfer
      const username = recipientUsername || recipient;
      if (!username) {
        return NextResponse.json(
          { error: "Missing recipient username" },
          { status: 400 },
        );
      }

      // fetching recipient's wallet address by username
      const supabase = await createSupabaseAnonClient();
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("user_id")
        .eq("username", username)
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
        throw new Error("Wallet not found");
      }

      recipientAddressFinal = walletData.classic_address;
    } else {
      // Direct address transfer
      recipientAddressFinal = recipientAddress || recipient;
      if (!recipientAddressFinal) {
        return NextResponse.json(
          { error: "Missing recipient address" },
          { status: 400 },
        );
      }
    }

    console.log("🚀 Sending XRP transfer:", {
      from: senderWallet.classicAddress || "unknown",
      to: recipientAddressFinal,
      amount: amount
    });

    const result = await sendXRP(
      senderWallet,
      recipientAddressFinal,
      amount,
      destinationTag,
    );
    return NextResponse.json({ message: result.message }, { status: 200 });
  } catch (error) {
    console.error("❌ XRP transfer error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
