import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import sendIOU from "@/utils/xrpl/transaction/sendIOU";
import { Wallet } from "xrpl";
import { sendIOUAPIRequest, sendIOUAPIResponse } from "@/types/api/transactionAPITypes";
import { APIErrorResponse } from "@/types/api/errorAPITypes";

export async function POST(req: NextRequest) {
  try {
    const {
      senderWallet,
      recipient,
      amount,
      currency,
      issuerWallets,
      destinationTag,
      useUsername,
    }: sendIOUAPIRequest = await req.json();

    // Validate required parameters
    if (!senderWallet) {
      return NextResponse.json<APIErrorResponse>({ message: "Missing sender wallet" }, { status: 400 });
    }

    if (!recipient) {
      return NextResponse.json<APIErrorResponse>({ message: "Missing recipient" }, { status: 400 });
    }

    if (!amount) {
      return NextResponse.json<APIErrorResponse>({ message: "Missing amount" }, { status: 400 });
    }

    if (!currency) {
      return NextResponse.json<APIErrorResponse>({ message: "Missing currency" }, { status: 400 });
    }

    if (!issuerWallets) {
      return NextResponse.json<APIErrorResponse>({ message: "Missing issuer wallets" }, { status: 400 });
    }

    let recipientAddress: string;

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

      if (walletError || !walletData) {
        throw new Error("Receiver wallet not found");
      }

      recipientAddress = walletData.classic_address;
    }
    // if an address is provided instead of a username
    else {
      recipientAddress = recipient;
    }

    // Get seed from Supabase using classicAddress
    const supabase = await createSupabaseAnonClient();
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", senderWallet.classicAddress)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json<APIErrorResponse>({ message: "Wallet not found for the provided classicAddress" }, { status: 404 });
    }

    const senderXRPLWallet = Wallet.fromSeed(walletData.seed);

    const result = await sendIOU(
      senderXRPLWallet,
      recipientAddress,
      amount,
      currency,
      issuerWallets,
      destinationTag ?? null,
    );
    if (!result.success) {
      return NextResponse.json<APIErrorResponse>({ message: result.message }, { status: 400 });
    }

    return NextResponse.json<sendIOUAPIResponse>({ message: result.message }, { status: 200 });
  } catch (error) {
    console.error("Error in /api/transaction/sendIOU:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIErrorResponse>({ message: `sendIOU failed: ${errorMessage}` }, { status: 500 });
  }
}
