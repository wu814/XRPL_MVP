import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

interface GetWalletAddressByUsernameRequest {
  username: string;
}

export async function POST(req: NextRequest) {
  try {
    const { username }: GetWalletAddressByUsernameRequest = await req.json();
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

    return NextResponse.json({ data: walletData }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      {
        error: `Error fetching user wallet address: ${errorMessage} [getWalletAddressByUsername/route.ts]`,
      },
      { status: 500 },
    );
  }
}
