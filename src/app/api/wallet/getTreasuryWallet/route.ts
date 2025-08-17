import { NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { APIErrorResponse } from "@/types/api/errorAPITypes";
import { GetTreasuryWalletAPIResponse } from "@/types/api/walletAPITypes";

export async function GET(): Promise<NextResponse<GetTreasuryWalletAPIResponse | APIErrorResponse>> {
  try {
    const supabase = await createSupabaseAnonClient();  

    const { data, error } = await supabase
      .from("wallets")
      .select("classic_address, wallet_type")
      .eq("wallet_type", "TREASURY");

    if (!data) {
      return NextResponse.json<APIErrorResponse>({ message: "No treasury wallet found" }, { status: 404 });
    }

    if (error) {
      return NextResponse.json<APIErrorResponse>({ message: `Error fetching treasury wallet: ${error.message}` }, { status: 500 });
    }

      return NextResponse.json<GetTreasuryWalletAPIResponse>({ message: "Treasury wallet fetched successfully", data: {
      classicAddress: data[0].classic_address,
      walletType: data[0].wallet_type,
    } }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json<APIErrorResponse>({ message: `Error fetching treasury wallet: ${error.message} [getTreasuryWallets/route.ts]` }, { status: 500 });
  }
}
