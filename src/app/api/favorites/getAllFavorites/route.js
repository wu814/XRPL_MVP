import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const username = session.user.username;
  const supabase = await createSupabaseAnonClient();

  try {
    // Get all favorites for the current user
    const { data: favorites, error } = await supabase
      .from("favorites")
      .select("*")
      .eq("user_username", username);

    if (error) throw error;

    return NextResponse.json({ data: favorites }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch favorites: ${err.message}` },
      { status: 500 },
    );
  }
} 