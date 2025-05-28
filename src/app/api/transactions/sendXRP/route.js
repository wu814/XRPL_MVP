import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import sendXRP from "@/utils/xrpl/transaction/sendXRP";

export async function POST(req) {
  try {
    const { senderWallet, recipientUsername, amount, destinationTag } =
      await req.json();

    if (!senderWallet || !recipientUsername || !amount) {
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

    const result = await sendXRP(
      senderWallet,
      recipientAddress,
      amount,
      destinationTag,
    );
    return NextResponse.json({ message: result.message }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
