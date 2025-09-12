import { NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";
import { APIResponse } from "@/types/apiTypes";
import { YONAWallet } from "@/types/appTypes";


export async function GET(): Promise<NextResponse<APIResponse<YONAWallet[]>>> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json<APIResponse<never>>({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  try {
    const supabase = await createSupabaseAnonClient();

    const { data, error } = await supabase
      .from("wallets")
      .select("classic_address, wallet_type")
      .eq("user_id", session.user.user_id);

    if (error) {
      return NextResponse.json<APIResponse<never>>({ success: false, message: `Error fetching wallets: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json<APIResponse<YONAWallet[]>>({ success: true, message: "Wallets fetched successfully", data: data.map((wallet) => ({
      classicAddress: wallet.classic_address,
      walletType: wallet.wallet_type,
    })) }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIResponse<never>>(
      {
        success: false,
        message: `Error fetching wallets: ${errorMessage} [getWalletsByUserID/route.ts]`,
      },
      { status: 500 },
    );
  }
}
