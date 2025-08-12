import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import createWallet  from "@/utils/xrpl/wallet/createWallet";
import { CreateWalletResponse } from "@/types/wallet";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.user_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const user_id = session.user.user_id;
  
  try {
    const { walletType }: { walletType: string } = await req.json();

    const walletData = await createWallet(walletType);

    const supabase = await createSupabaseAnonClient();
    const { error } = await supabase.from("wallets").insert([
      {
        user_id,
        classic_address: walletData.classicAddress,
        wallet_type: walletData.walletType,
        seed: walletData.seed,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) throw error;

    return NextResponse.json<CreateWalletResponse>(
      {
        success: true,
        message: `${walletData.walletType} wallet created!`,
        data: walletData,
      },
      { status: 201 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json<CreateWalletResponse>(
      { success: false, error: `Error creating wallet: ${errorMessage}` },
      { status: 500 }
    );
  }
}
