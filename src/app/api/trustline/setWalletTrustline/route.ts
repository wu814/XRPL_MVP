import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { setTrustline } from "@/utils/xrpl/trustline/setTrustline";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { Wallet } from "xrpl";
import { YONAWallet } from "@/types/appTypes";

interface SetWalletTrustlineRequest {
  setterWallet: {
    classicAddress: string;
  };
  issuerWallets: YONAWallet[];
  currency: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.user_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { setterWallet, issuerWallets, currency }: SetWalletTrustlineRequest = await req.json();

    if (!setterWallet) {
      return NextResponse.json({ error: "Missing setterWallet" }, { status: 400 });
    }

    if (!issuerWallets?.[0]?.classicAddress) {
      return NextResponse.json({ error: "Missing issuerWallets" }, { status: 400 });
    }

    if (!currency) {
      return NextResponse.json({ error: "Missing currency" }, { status: 400 });
    }

    // Get seed from Supabase using classicAddress
    const supabase = await createSupabaseAnonClient();
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", setterWallet.classicAddress)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json(
        { error: "Wallet not found for the provided classicAddress" },
        { status: 404 },
      );
    }

    const setterXrplWallet = Wallet.fromSeed(walletData.seed);

    const result = await setTrustline(
      setterXrplWallet,
      issuerWallets[0].classicAddress,
      currency,
      issuerWallets,
    );

    return NextResponse.json({ message: result.message }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: `Trustline setup failed: ${errorMessage}` },
      { status: 500 },
    );
  }
}
