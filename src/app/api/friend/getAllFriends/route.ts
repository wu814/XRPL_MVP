import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";

import { createSupabaseAnonClient } from "@/utils/supabase/server";

interface FriendRequest {
  id: string;
  sender: string;
  receiver: string;
  responded_at: string;
}

interface Friend {
  id: string;
  username: string;
  responded_at: string;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const username = session.user.username;

  const supabase = await createSupabaseAnonClient();

  try {
    const { data, error } = await supabase
      .from("friend_requests")
      .select("id, sender, receiver, responded_at")
      .or(`sender.eq.${username},receiver.eq.${username}`)
      .eq("status", "accepted");

    if (error) throw error;

    // Filter and normalize to always return the other user's info
    const friends: Friend[] = data.map((req: FriendRequest) => {
      const isSender = req.sender === username;
      return {
        id: req.id,
        username: isSender ? req.receiver : req.sender,
        responded_at: req.responded_at,
      };
    });

    return NextResponse.json({ data: friends }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: `Failed to fetch friends: ${errorMessage}` },
      { status: 500 },
    );
  }
}
