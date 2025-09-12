import { NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { APIResponse } from "@/types/apiTypes";
import { YONAWallet } from "@/types/appTypes";

export async function GET(): Promise<NextResponse<APIResponse<YONAWallet[]>>> {
  try {
    const supabase = await createSupabaseAnonClient();

    const { data, error } = await supabase
      .from("wallets")
      .select("classic_address, wallet_type")
      .eq("wallet_type", "ISSUER");

    if (error){
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: `Error fetching issuer wallet: ${error.message} [getIssuerWallets/route.ts]` },
        { status: 500 },
      );
    }

    return NextResponse.json<APIResponse<YONAWallet[]>>({ success: true, message: "Issuer wallets fetched successfully", data: data.map((wallet) => ({
      classicAddress: wallet.classic_address,
      walletType: wallet.wallet_type,
    })) }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIResponse<never>>(
      {
        success: false,
        message: `Error fetching issuer wallet: ${errorMessage} [getIssuerWallets/route.ts]`,
      },
      { status: 500 },
    );
  }
}
