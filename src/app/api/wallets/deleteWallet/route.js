import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import bcrypt from "bcryptjs";

export async function DELETE(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.user_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { classicAddress, enteredPassword } = await req.json();

    if (!classicAddress) {
      return NextResponse.json(
        { error: "Missing classic address" },
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
      return new Response(JSON.stringify({ error: "Invalid password." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase
      .from("wallets")
      .delete()
      .eq("classic_address", classicAddress);

    if (error) throw error;

    return NextResponse.json({ message: "Wallet deleted successfully!" });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Error deleting wallet: ${error.message} [deleteWallet/route.js]`,
      },
      { status: 500 },
    );
  }
}
