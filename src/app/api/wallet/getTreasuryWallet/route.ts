import { NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { APIResponse } from "@/types/apiTypes";
import { YONAWallet } from "@/types/appTypes";

export async function GET(): Promise<NextResponse<APIResponse<YONAWallet>>> {
  try {
    const supabase = await createSupabaseAnonClient();  

    const { data, error } = await supabase
      .from("wallets")
      .select("classic_address, wallet_type")
      .eq("wallet_type", "TREASURY");

    if (!data) {
      return NextResponse.json<APIResponse<never>>({ success: false, message: "No treasury wallet found" }, { status: 404 });
    }

    if (error) {
      return NextResponse.json<APIResponse<never>>({ success: false, message: `Error fetching treasury wallet: ${error.message}` }, { status: 500 });
    }

      return NextResponse.json<APIResponse<YONAWallet>>({ success: true, message: "Treasury wallet fetched successfully", data: {
      classicAddress: data[0].classic_address,
      walletType: data[0].wallet_type,
    } }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json<APIResponse<never>>({ success: false, message: `Error fetching treasury wallet: ${error.message} [getTreasuryWallets/route.ts]` }, { status: 500 });
  }
}
