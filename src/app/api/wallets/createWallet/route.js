import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import createWallet from "@/utils/xrpl/wallet/createWallet";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.user_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user_id = session.user.user_id;
  try {
    const { walletType } = await req.json();

    // Create wallet on the XRPL
    const walletData = await createWallet(walletType);

    // Store the new wallet in the database
    const supabase = await createSupabaseAnonClient();
    const { data, error } = await supabase.from("wallets").insert([
      {
        user_id: user_id,
        classic_address: walletData.classicAddress,
        wallet_type: walletData.walletType,
        seed: walletData.seed,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) throw error;
    return NextResponse.json(
      {
        message: `${walletData.walletType} wallet created!`,
        data: walletData,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: `Error creating wallet: ${error.message} [createWallet/route.js]`,
      },
      { status: 500 },
    );
  }
}
