// /app/api/friends/getFriends/route.ts
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
    const { data, error } = await supabase
      .from("friend_requests")
      .select("id, sender, receiver, responded_at")
      .or(`sender.eq.${username},receiver.eq.${username}`)
      .eq("status", "accepted");

    if (error) throw error;

    // Filter and normalize to always return the other user's info
    const friends = data.map((req) => {
      const isSender = req.sender === username;
      return {
        id: req.id,
        username: isSender ? req.receiver : req.sender,
        responded_at: req.responded_at,
      };
    });

    return NextResponse.json({ data: friends }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch friends: ${err.message}` },
      { status: 500 }
    );
  }
}
