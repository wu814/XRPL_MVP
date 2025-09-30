import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";

import createWallet from "@/utils/xrpl/wallet/createWallet";
import { CreateWalletResult } from "@/types/xrpl/walletXRPLTypes";
import { APIResponse, CreateWalletAPIRequest } from "@/types/apiTypes";
import { YONAWallet } from "@/types/appTypes";


export async function POST(req: NextRequest): Promise<NextResponse<APIResponse<YONAWallet>>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.user_id) {
    return NextResponse.json<APIResponse<never>>({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  
  const user_id = session.user.user_id;
  
  try {
    const { walletType }: CreateWalletAPIRequest = await req.json();

    const walletResult: CreateWalletResult = await createWallet(walletType);
    
    if (!walletResult.success) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: walletResult.message || "Failed to create wallet" },
        { status: 500 }
      );
    }

    const supabase = await createSupabaseAnonClient();
    const { error } = await supabase.from("wallets").insert([
      {
        user_id,
        classic_address: walletResult.data.wallet.address,
        wallet_type: walletType,
        seed: walletResult.data.wallet.seed,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) throw error;

    return NextResponse.json<APIResponse<YONAWallet>>(
      {
        success: true,
        message: walletResult.message,
        data: {
          classicAddress: walletResult.data.wallet.address,
          walletType: walletType,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json<APIResponse<never>>(
      { success: false, message: `Error creating wallet: ${errorMessage}` },
      { status: 500 }
    );
  }
}
