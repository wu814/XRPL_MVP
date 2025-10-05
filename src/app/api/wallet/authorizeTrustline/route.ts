import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";

import authorizeTrustline from "@/utils/xrpl/trustline/authorizeTrustline";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { Wallet } from "xrpl";
import { AuthorizeTrustlineAPIRequest } from "@/types/apiTypes";
import { APIResponse } from "@/types/apiTypes";



export async function POST(req: NextRequest): Promise<NextResponse<APIResponse<never>>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.user_id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { issuerWallet, trustlineAddress, currency }: AuthorizeTrustlineAPIRequest = await req.json();

    if (!issuerWallet) {
      return NextResponse.json({ success: false, message: "Missing issuerWallet" }, { status: 400 });
    }

    if (!trustlineAddress) {
      return NextResponse.json({ success: false, message: "Missing trustlineAddress" }, { status: 400 });
    }

    if (!currency) {
      return NextResponse.json({ success: false, message: "Missing currency" }, { status: 400 });
    }

    // Get seed from Supabase using classicAddress
    const supabase = await createSupabaseAnonClient();
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", issuerWallet.classicAddress)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json(
        { success: false, message: "Wallet not found for the provided classicAddress" },
        { status: 404 },
      );
    }

    const issuerXRPLWallet = Wallet.fromSeed(walletData.seed);

    const result = await authorizeTrustline(issuerXRPLWallet, trustlineAddress, currency);

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, message: result.message }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { success: false, message: `Failed to authorize trustline: ${errorMessage}` },
      { status: 500 },
    );
  }
}

