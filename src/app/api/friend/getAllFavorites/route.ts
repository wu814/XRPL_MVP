import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";
import { APIResponse } from "@/types/apiTypes";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { Favorite } from "@/types/appTypes";

export async function GET(): Promise<NextResponse<APIResponse<Favorite[]>>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) {
    return NextResponse.json<APIResponse<never>>({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const username = session.user.username;
  const supabase = await createSupabaseAnonClient();

  try {
    // Get all favorites for the current user
    const { data: favorites, error } = await supabase
      .from("favorites")
      .select("*")
      .eq("user_username", username);

    if (error) {
      return NextResponse.json<APIResponse<never>>({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json<APIResponse<Favorite[]>>({ success: true, message: "Favorites fetched", data: favorites.map((favorite) => ({
      id: favorite.id,
      friend_username: favorite.friend_username,
    })) }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return NextResponse.json<APIResponse<never>>({ success: false, message: `Failed to fetch favorites: ${errorMessage}` }, { status: 500 });
  }
}
