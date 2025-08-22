import { NextRequest, NextResponse } from "next/server";
import cancelOffer from "@/utils/xrpl/dex/cancelOffer";
import { Wallet } from "xrpl";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";

import { createSupabaseAnonClient } from "@/utils/supabase/server";

interface CancelOfferRequest {
  userWallet: {
    classicAddress: string;
  };
  offerSequence: number;
  enteredPassword: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.user_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { userWallet, offerSequence, enteredPassword }: CancelOfferRequest = await req.json();

    if (!userWallet) {
      return NextResponse.json(
        { error: "Missing user wallet" },
        { status: 400 },
      );
    }

    if (!offerSequence) {
      return NextResponse.json(
        { error: "Missing offer sequence" },
        { status: 400 },
      );
    }

    if (!enteredPassword) {
      return NextResponse.json(
        { error: "Missing entered password" },
        { status: 400 },
      );
    }

    // Validate password
    const supabase = await createSupabaseAnonClient();

    const { data: passwordData, error: passwordError } = await supabase
      .from("passwords")
      .select("password")
      .eq("user_id", session.user.user_id)
      .single();

    if (passwordError) {
      throw new Error(passwordError.message);
    }

    const isMatch = await bcrypt.compare(
      enteredPassword,
      passwordData.password,
    );

    if (!isMatch) {
      return NextResponse.json({ error: "Invalid password." }, { status: 403 });
    }

    // Get seed from Supabase using classicAddress
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", userWallet.classicAddress)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json(
        { error: "Wallet not found for the provided classicAddress" },
        { status: 404 },
      );
    }

    const cancelerWallet = Wallet.fromSeed(walletData.seed);

    const result = await cancelOffer(cancelerWallet, offerSequence);

    return NextResponse.json(
      {
        success: result.success,
        message: result.message,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("CancelOffer API error:", err);
    const errorMessage = err instanceof Error ? err.message : 'Unexpected error.';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
