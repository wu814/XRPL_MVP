import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";

import { createSupabaseAnonClient } from "@/utils/supabase/server";

interface RemoveFromFavoriteRequest {
  friendUsername: string;
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { friendUsername }: RemoveFromFavoriteRequest = await req.json();
  const userUsername = session.user.username;

  if (!friendUsername) {
    return NextResponse.json({ error: "Missing friend username" }, { status: 400 });
  }

  const supabase = await createSupabaseAnonClient();

  try {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_username", userUsername)
      .eq("friend_username", friendUsername);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Friend removed from favorites" }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: `Failed to remove favorite: ${errorMessage}` },
      { status: 500 }
    );
  }
}
