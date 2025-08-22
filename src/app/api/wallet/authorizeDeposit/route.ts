import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";

import authorizeDeposit from "@/utils/xrpl/wallet/authorizeDeposit";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { Wallet } from "xrpl";

interface AuthorizeDepositRequest {
  walletWithDepositAuth: {
    classicAddress: string;
  };
  authorizedAddress: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.user_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { walletWithDepositAuth, authorizedAddress }: AuthorizeDepositRequest = await req.json();

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

    const walletWithDepositAuthXRPLWallet = Wallet.fromSeed(walletData.seed);

    const result = await authorizeDeposit(walletWithDepositAuthXRPLWallet, authorizedAddress);

    return NextResponse.json({ message: result.message });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: `Failed to authorize deposit: ${errorMessage}` },
      { status: 500 },
    );
  }
}
