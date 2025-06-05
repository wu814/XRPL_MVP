import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userID = session.user.user_id;
  try {
    const supabase = await createSupabaseAnonClient();

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", userID)
      .single();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: `Error fetching user: ${error.message}` },
      { status: 500 },
    );
  }
}
