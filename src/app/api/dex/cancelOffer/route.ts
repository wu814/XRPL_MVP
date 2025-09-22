import { NextRequest, NextResponse } from "next/server";
import cancelOffer from "@/utils/xrpl/dex/cancelOffer";
import { Wallet } from "xrpl";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";

import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { CancelOfferAPIRequest, APIResponse } from "@/types/apiTypes";


export async function POST(req: NextRequest): Promise<NextResponse<APIResponse<never>>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.user_id) {
    return NextResponse.json<APIResponse<never>>({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { userWallet, offerSequence, enteredPassword }: CancelOfferAPIRequest = await req.json();

    if (!userWallet) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Missing user wallet" },
        { status: 400 },
      );
    }

    if (!offerSequence) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Missing offer sequence" },
        { status: 400 },
      );
    }

    if (!enteredPassword) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Missing entered password" },
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
      return NextResponse.json<APIResponse<never>>({ success: false, message: "Invalid password." }, { status: 403 });
    }

    // Get seed from Supabase using classicAddress
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", userWallet.classicAddress)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Wallet not found for the provided classicAddress" },
        { status: 404 },
      );
    }

    const cancelerWallet = Wallet.fromSeed(walletData.seed);

    const result = await cancelOffer(cancelerWallet, offerSequence);

    return NextResponse.json<APIResponse<never>>(
      {
        success: result.success,
        message: result.message,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("CancelOffer API error:", err);
    const errorMessage = err instanceof Error ? err.message : 'Unexpected error.';
    return NextResponse.json<APIResponse<never>>(
      { success: false, message: errorMessage },
      { status: 500 },
    );
  }
}
