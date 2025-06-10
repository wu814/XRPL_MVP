import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import createAmm from "@/utils/xrpl/amm/createAmm";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.is_admin) {
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
    } = await req.json();
    // Create AMM on the XRPL
    const ammData = await createAmm(
      treasuryWallet,
      issuerWallets,
      assetA,
      amountA,
      assetB,
      amountB,
      fee,
    );

    // Store the new AMM in the database
    const supabase = await createSupabaseAnonClient();
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
    const pairString = `${ammData.currency_a.currency}/${ammData.currency_b.currency}`;
    
    return NextResponse.json(
      {
        message: `${pairString} AMM created! Address: ${ammData.ammAccount}`,
        data: ammData,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: `Error creating AMM: ${error.message} [createAmm/route.js]` },
      { status: 500 },
    );
  }
}
