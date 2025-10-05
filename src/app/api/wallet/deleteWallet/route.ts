import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";
import { DeleteWalletAPIRequest, APIResponse } from "@/types/apiTypes";
import bcrypt from "bcryptjs";


export async function DELETE(req: NextRequest): Promise<NextResponse<APIResponse<never>>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.user_id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  try {
    const { classicAddress, enteredPassword }: DeleteWalletAPIRequest = await req.json();

    if (!classicAddress) {
      return NextResponse.json(
        { success: false, message: "Missing classic address" },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseAnonClient();

    const { data: passwordData, error: passwordError } = await supabase
      .from("passwords")
      .select("password")
      .eq("user_id", session.user.user_id)
      .single();

    if (passwordError) {
      throw new Error(passwordError.message);
    }

    // Compare the entered password to the stored hash
    const isMatch = await bcrypt.compare(
      enteredPassword,
      passwordData.password,
    );
    if (!isMatch) {
      return NextResponse.json(
        { success: false, message: "Invalid password." },
        { status: 403 },
      );
    }

    const { data, error } = await supabase
      .from("wallets")
      .delete()
      .eq("classic_address", classicAddress);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Wallet deleted successfully!" }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      {
        success: false,
        message: `Error deleting wallet: ${errorMessage} [deleteWallet/route.ts]`,
      },
      { status: 500 },
    );
  }
}
