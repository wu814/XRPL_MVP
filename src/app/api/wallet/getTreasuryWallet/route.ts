import { NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseAnonClient();

    const { data, error } = await supabase
      .from("wallets")
      .select("classic_address, wallet_type")
      .eq("wallet_type", "TREASURY");

    if (error) throw error;

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      {
        error: `Error fetching treasury wallet: ${errorMessage} [getTreasuryWallets/route.ts]`,
      },
      { status: 500 },
    );
    }
}
