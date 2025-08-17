import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import sendXRP from "@/utils/xrpl/transaction/sendXRP";
import { Wallet } from "xrpl";

interface SendXRPRequest {
  senderWallet: {
    classicAddress: string;
  };
  recipientUsername?: string;
  recipientAddress?: string;
  recipient?: string;
  amount: string | number;
  destinationTag?: number;
  useUsername?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const { senderWallet, recipientUsername, recipientAddress, recipient, amount, destinationTag, useUsername }: SendXRPRequest =
      await req.json();

    if (!senderWallet) {
      return NextResponse.json(
        { error: "Missing sender wallet" },
        { status: 400 },
      );
    }

    if (!amount) {
      return NextResponse.json({ error: "Missing amount" }, { status: 400 });
    }

    let recipientAddressFinal: string;

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

    const result = await sendXRP(
      senderXRPLWallet,
      recipientAddressFinal,
      amount,
      destinationTag,
    );
    return NextResponse.json({ message: result.message }, { status: 200 });
  } catch (error) {
    console.error("❌ XRP transfer error:", error instanceof Error ? error.message : 'Unknown error');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
