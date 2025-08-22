import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";

import { createSupabaseAnonClient } from "@/utils/supabase/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const friendUsername = searchParams.get("friendUsername");
  const userUsername = session.user.username;

  if (!friendUsername) {
    return NextResponse.json({ error: "Missing friend username" }, { status: 400 });
  }

  const supabase = await createSupabaseAnonClient();

  try {
    const { data, error } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_username", userUsername)
      .eq("friend_username", friendUsername)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" which is OK
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ isFavorited: !!data }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: `Failed to check favorite status: ${errorMessage}` },
      { status: 500 }
    );
  }
}
