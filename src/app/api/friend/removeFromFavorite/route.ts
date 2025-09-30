import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";
import { RemoveFromFavoriteAPIRequest, APIResponse } from "@/types/apiTypes";
import { createSupabaseAnonClient } from "@/utils/supabase/server";



export async function DELETE(req: NextRequest): Promise<NextResponse<APIResponse<never>>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { friendUsername }: RemoveFromFavoriteAPIRequest = await req.json();
  const userUsername = session.user.username;

  if (!friendUsername) {
    return NextResponse.json({ success: false, message: "Missing friend username" }, { status: 400 });
  }

  const supabase = await createSupabaseAnonClient();

  try {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_username", userUsername)
      .eq("friend_username", friendUsername);

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Friend removed from favorites" }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      return NextResponse.json({ success: false, message: `Failed to remove favorite: ${errorMessage}` }, { status: 500 });
  }
}