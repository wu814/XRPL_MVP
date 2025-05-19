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
        amm_address: ammData.ammAddress,
        pair: ammData.pair,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) throw error;
    return NextResponse.json(
      { message: `${ammData.pair} AMM created! Address: ${ammData.ammAddress}`,
        data: ammData 
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
