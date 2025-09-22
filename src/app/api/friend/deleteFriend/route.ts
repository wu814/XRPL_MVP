import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";
import { DeleteFriendAPIRequest, APIResponse } from "@/types/apiTypes";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

export async function DELETE(req: NextRequest): Promise<NextResponse<APIResponse<never>>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) {
    return NextResponse.json<APIResponse<never>>({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { id }: DeleteFriendAPIRequest = await req.json();
  const currentUsername = session.user.username;

  if (!id) {
    return NextResponse.json<APIResponse<never>>({ success: false, message: "Missing friend request ID" }, { status: 400 });  
  }

  const supabase = await createSupabaseAnonClient();

  // Optional: Verify that the current user is part of this friendship
  const { data: request, error: fetchError } = await supabase
    .from("friend_requests")
    .select("id, sender, receiver")
    .eq("id", id)
    .single();

  if (fetchError || !request) {
    return NextResponse.json<APIResponse<never>>({ success: false, message: "Friendship not found" }, { status: 404 });
  }

  if (
    request.sender !== currentUsername &&
    request.receiver !== currentUsername
  ) {
    return NextResponse.json<APIResponse<never>>({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const { error: deleteError } = await supabase
    .from("friend_requests")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json<APIResponse<never>>({ success: false, message: deleteError.message }, { status: 500 });
  }

  return NextResponse.json<APIResponse<never>>({ success: true, message: "Friend removed" }, { status: 200 });
}
