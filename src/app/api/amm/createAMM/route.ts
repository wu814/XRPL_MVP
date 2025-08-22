import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";

import createAMM from "@/utils/xrpl/amm/createAMM";
import { Wallet } from "xrpl";
import { CreateAMMAPIRequest, CreateAMMAPIResponse } from "@/types/api/ammAPITypes";
import { APIErrorResponse } from "@/types/api/errorAPITypes";

export async function POST(req: NextRequest): Promise<NextResponse<CreateAMMAPIResponse | APIErrorResponse>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || session.user.role !== "ADMIN") {
    return NextResponse.json<APIErrorResponse>(
      { message: "Must be an Admin to create AMMs" },
      { status: 401 },
    );
  }

  try { 
    const {
      treasuryWallet,
      issuerWallets,
      currency1,
      value1,
      currency2,
      value2,
      tradingFee,
    }: CreateAMMAPIRequest = await req.json();

    const supabase = await createSupabaseAnonClient();
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", treasuryWallet.classicAddress)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json<APIErrorResponse>(
        { message: "Wallet not found for the provided classicAddress" },
        { status: 404 },
      );
    }

    const treasuryXRPLWallet = Wallet.fromSeed(walletData.seed);

    // Create AMM on the XRPL
    const ammData = await createAMM(
      treasuryXRPLWallet,
      issuerWallets,
      currency1,
      value1,
      currency2,
      value2,
      tradingFee,
    );

    if (!ammData.success) {
      return NextResponse.json<APIErrorResponse>(
        { message: ammData.error?.message || "AMM creation failed" },
        { status: 400 },
      );
    }

    // Store the new AMM in the database
    const { data, error } = await supabase.from("amms").insert([
      {
        account: ammData.account,
        currency1: ammData.currency1,
        currency2: ammData.currency2,
        created_at: new Date().toISOString(),
        issuer_address: issuerWallets[0].classicAddress,
        treasury_address: treasuryWallet.classicAddress,
      },
    ]);

    if (error) throw error;
    
    // Create a readable pair string for the message
    const pairString = `${ammData.currency1}/${ammData.currency2}`;
    
    return NextResponse.json<CreateAMMAPIResponse>(
      {
        message: `${pairString} AMM created! Address: ${ammData.account}`,
        data: ammData,
      },
      { status: 201 },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIErrorResponse>(
      { message: `Error creating AMM: ${errorMessage} [createAMM/route.ts]` },
      { status: 500 },
    );
  }
}
