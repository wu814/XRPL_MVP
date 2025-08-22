import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";

import { createSupabaseAnonClient } from "@/utils/supabase/server";

interface DeleteFriendRequest {
  id: string;
}

interface FriendRequest {
  id: string;
  sender: string;
  receiver: string;
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id }: DeleteFriendRequest = await req.json();
  const currentUsername = session.user.username;

  if (!id) {
    return NextResponse.json(
      { error: "Missing friend request ID" },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseAnonClient();

  // Optional: Verify that the current user is part of this friendship
  const { data: request, error: fetchError } = await supabase
    .from("friend_requests")
    .select("id, sender, receiver")
    .eq("id", id)
    .single();

  if (fetchError || !request) {
    return NextResponse.json(
      { error: "Friendship not found" },
      { status: 404 },
    );
  }

  if (
    request.sender !== currentUsername &&
    request.receiver !== currentUsername
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: deleteError } = await supabase
    .from("friend_requests")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Friendship deleted" }, { status: 200 });
}
