import { NextRequest, NextResponse } from "next/server";
import { checkTrustline } from "@/utils/xrpl/trustline/setTrustline";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import {APIResponse, CheckTrustlineAPIRequest } from "@/types/apiTypes";

export async function POST(req: NextRequest): Promise<NextResponse<APIResponse<{ hasTrustline: boolean }>>> {
  try {
    const { walletAddress, destination, currency }: CheckTrustlineAPIRequest = await req.json();

    if (!walletAddress) {
      return NextResponse.json<APIResponse<never>>( { success: false, message: "Failed to check trustline: Missing walletAddress" }, { status: 400 });
    }
    if (!destination) {
      return NextResponse.json<APIResponse<never>>( { success: false, message: "Failed to check trustline: Missing destination" }, { status: 400 });
    }
    if (!currency) {
      return NextResponse.json<APIResponse<never>>( { success: false, message: "Failed to check trustline: Missing currency" }, { status: 400 });
    }

    // Get seed from Supabase using classicAddress
    const supabase = await createSupabaseAnonClient();
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", walletAddress)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Failed to check trustline: Wallet not found for the provided classicAddress" },
        { status: 404 },
      );
    }

    const hasTrustline = await checkTrustline(
      walletAddress,
      destination,
      currency,
    );

    return NextResponse.json<APIResponse<{ hasTrustline: boolean }>>({ success: true, message: "Trustline checked successfully", data: { hasTrustline } }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to check trustline.';
    return NextResponse.json<APIResponse<never>>(
      { success: false, message: errorMessage },
      { status: 500 },
    );
  }
}
