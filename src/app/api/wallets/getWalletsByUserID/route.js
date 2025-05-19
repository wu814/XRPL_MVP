import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const supabase = await createSupabaseAnonClient();

    const { data, error } = await supabase
      .from("wallets")
      .select("classic_address, wallet_type, seed")
      .eq("user_id", session.user.user_id);

    if (error) throw error;

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Error fetching wallets: ${error.message} [getWalletsByUserID/route.js]`,
      },
      { status: 500 },
    );
  }
}
