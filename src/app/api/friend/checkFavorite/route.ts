import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { APIResponse } from "@/types/apiTypes";

export async function GET(req: NextRequest): Promise<NextResponse<APIResponse<{isFavorited: boolean}>>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) {
    return NextResponse.json<APIResponse<never>>({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const friendUsername = searchParams.get("friendUsername");
  const userUsername = session.user.username;

  if (!friendUsername) {
    return NextResponse.json<APIResponse<never>>({ success: false, message: "Missing friend username" }, { status: 400 });
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
      return NextResponse.json<APIResponse<{isFavorited: boolean}>>({ success: true, message: "Friend is not favorited", data: { isFavorited: false } }, { status: 500 });
    }

    return NextResponse.json<APIResponse<{isFavorited: boolean}>>({ success: true, message: "Friend is favorited", data: { isFavorited: !!data } }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return NextResponse.json(
      { success: false, message: `Failed to check favorite status: ${errorMessage}` },
      { status: 500 }
    );
  }
}
