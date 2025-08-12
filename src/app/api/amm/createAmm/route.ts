import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import createAmm from "@/utils/xrpl/amm/createAmm";
import { Wallet } from "xrpl";

interface CreateAmmRequest {
  treasuryWallet: {
    classicAddress: string;
  };
  issuerWallets: Array<{
    classicAddress: string;
  }>;
  assetA: string;
  amountA: string;
  assetB: string;
  amountB: string;
  fee: number;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Must be an Admin to create AMMs" },
      { status: 401 },
    );
  }

  try {
    const {
      treasuryWallet,
      issuerWallets,
      assetA,
      amountA,
      assetB,
      amountB,
      fee,
    }: CreateAmmRequest = await req.json();

    const supabase = await createSupabaseAnonClient();
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", treasuryWallet.classicAddress)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json(
        { error: "Wallet not found for the provided classicAddress" },
        { status: 404 },
      );
    }

    const treasuryXrplWallet = Wallet.fromSeed(walletData.seed);

    // Create AMM on the XRPL
    const ammData = await createAmm(
      treasuryXrplWallet,
      issuerWallets,
      assetA,
      amountA,
      assetB,
      amountB,
      fee,
    );

    // Store the new AMM in the database
    const { data, error } = await supabase.from("amms").insert([
      {
        amm_account: ammData.ammAccount,
        currency_a: ammData.currency_a,
        currency_b: ammData.currency_b,
        created_at: new Date().toISOString(),
        issuer_address: issuerWallets[0].classicAddress,
        treasury_address: treasuryWallet.classicAddress,
      },
    ]);

    if (error) throw error;
    
    // Create a readable pair string for the message
    const pairString = `${ammData.currency_a}/${ammData.currency_b}`;
    
    return NextResponse.json(
      {
        message: `${pairString} AMM created! Address: ${ammData.ammAccount}`,
        data: ammData,
      },
      { status: 201 },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: `Error creating AMM: ${errorMessage} [createAmm/route.ts]` },
      { status: 500 },
    );
  }
}
