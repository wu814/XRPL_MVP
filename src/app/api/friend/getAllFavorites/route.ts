import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";

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
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: `Failed to fetch favorites: ${errorMessage}` },
      { status: 500 },
    );
  }
}
