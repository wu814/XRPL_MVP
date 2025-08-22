import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";

import { setTrustline } from "@/utils/xrpl/trustline/setTrustline";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { Wallet } from "xrpl";
import { SetWalletTrustlineAPIRequest, SetWalletTrustlineAPIResponse } from "@/types/api/trustlineAPITypes";
import { APIErrorResponse } from "@/types/api/errorAPITypes";


export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.user_id) {
    return NextResponse.json<APIErrorResponse>({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { setterWallet, issuerWallets, currency }: SetWalletTrustlineAPIRequest = await req.json();

    if (!setterWallet) {
      return NextResponse.json<APIErrorResponse>({ message: "Missing setterWallet" }, { status: 400 });
    }
    if (!issuerWallets?.[0]?.classicAddress) {
      return NextResponse.json<APIErrorResponse>({ message: "Missing issuerWallets" }, { status: 400 });
    }
    if (!currency) {
      return NextResponse.json<APIErrorResponse>({ message: "Missing currency" }, { status: 400 });
    }

    // Get seed from Supabase using classicAddress
    const supabase = await createSupabaseAnonClient();
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", setterWallet.classicAddress)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json<APIErrorResponse>(
        { message: "Wallet not found for the provided classicAddress" },
        { status: 404 },
      );
    }

    const setterXRPLWallet = Wallet.fromSeed(walletData.seed);

    const result = await setTrustline(
      setterXRPLWallet,
      issuerWallets[0].classicAddress,
      currency,
      issuerWallets,
    );

    if (!result.success) {
      return NextResponse.json<APIErrorResponse>(
        { message: result.message },
        { status: 500 },
      );
    }

    return NextResponse.json<SetWalletTrustlineAPIResponse>({ message: result.message }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return NextResponse.json<APIErrorResponse>(
      { message: `Trustline setup failed: ${errorMessage}` },
      { status: 500 },
    );
  }
}
