import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import authorizeDeposit from "@/utils/xrpl/wallet/authorizeDeposit";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { Wallet } from "xrpl";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.user_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { walletWithDepositAuth, authorizedAddress } = await req.json();

    if (!walletWithDepositAuth) {
      return NextResponse.json({ error: "Missing walletWithDepositAuth" }, { status: 400 });
    }

    if (!authorizedAddress) {
      return NextResponse.json({ error: "Missing authorizedAddress" }, { status: 400 });
    }

    // Get seed from Supabase using classicAddress
    const supabase = await createSupabaseAnonClient();
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", walletWithDepositAuth.classicAddress)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json(
        { error: "Wallet not found for the provided classicAddress" },
        { status: 404 },
      );
    }

    const walletWithDepositAuthXrplWallet = Wallet.fromSeed(walletData.seed);

    const result = await authorizeDeposit(walletWithDepositAuthXrplWallet, authorizedAddress);

    return NextResponse.json({ message: result.message });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to authorize deposit: ${error.message}` },
      { status: 500 },
    );
  }
}
