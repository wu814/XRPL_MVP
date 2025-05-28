import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req) {
  try {
    const { username } = await req.json();
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

    if (walletError || walletData.length === 0) {
      throw new Error("Wallet not found");
    }

    return NextResponse.json({ data: walletData }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Error fetching user wallet address: ${error.message} [getWalletAddressByUsername/route.js]`,
      },
      { status: 500 },
    );
  }
}
