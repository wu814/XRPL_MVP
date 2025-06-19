import cancelOffer from "@/utils/xrpl/offer/cancelOffer";
import { Wallet } from "xrpl";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.user_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { walletSeed, offerSequence, enteredPassword } = await req.json();

    if (!walletSeed || !offerSequence || !enteredPassword) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
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
      passwordData.password
    );

    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid password." },
        { status: 403 }
      );
    }

    // Reconstruct wallet and cancel the offer
    const wallet = Wallet.fromSeed(walletSeed);
    const result = await cancelOffer(wallet, offerSequence);

    return NextResponse.json(
      {
        success: result.success,
        message: result.message,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("CancelOffer API error:", err);
    return NextResponse.json(
      { error: err.message || "Unexpected error." },
      { status: 500 }
    );
  }
}
