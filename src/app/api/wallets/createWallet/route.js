import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.user_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user_id = session.user.user_id;
  try {
    const supabase = await createSupabaseAnonClient();
    const {
      classicAddress,
      walletType,
      seed,
      createdAt,
    } = await req.json();
    console.log("New Wallet data:", {
      user_id,
      classic_address: classicAddress,
      wallet_type: walletType,
      seed,
      created_at: createdAt,
    });

    const { data, error } = await supabase.from("wallets").insert([
      {
        user_id,
        classic_address: classicAddress,
        wallet_type: walletType,
        seed,
        created_at: createdAt,
      }
    ]);

    if (error) throw error;
    return NextResponse.json(
      { message: `${walletType} wallet created!`, data },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: `${error.message} [createWallet/route.js]` }, 
      { status: 500 }
    );
  }
}
