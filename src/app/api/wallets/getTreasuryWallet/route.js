import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createSupabaseAnonClient();

    const { data, error } = await supabase
      .from("wallets")
      .select("classic_address, wallet_type, seed")
      .eq("wallet_type", "STANDBY TREASURY");

    if (error) throw error;

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: `Error fetching treasury wallet: ${error.message} [getTreasuryWallets/route.js]` },
      { status: 500 },
    );
  }
}
