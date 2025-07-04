import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { friendUsername } = await req.json();
  const userUsername = session.user.username;

  if (!friendUsername || friendUsername === userUsername) {
    return NextResponse.json({ error: "Invalid friend username" }, { status: 400 });
  }

  const supabase = await createSupabaseAnonClient();

  try {
    // First, verify that they are actually friends
    const { data: friendship, error: friendshipError } = await supabase
      .from("friend_requests")
      .select("id")
      .or(`and(sender.eq.${userUsername},receiver.eq.${friendUsername}),and(sender.eq.${friendUsername},receiver.eq.${userUsername})`)
      .eq("status", "accepted")
      .single();

    if (friendshipError || !friendship) {
      return NextResponse.json({ error: "You are not friends with this user" }, { status: 404 });
    }

    // Check if already favorited
    const { data: existing, error: checkError } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_username", userUsername)
      .eq("friend_username", friendUsername)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Friend is already favorited" }, { status: 409 });
    }

    // Add to favorites
    const { error: insertError } = await supabase
      .from("favorites")
      .insert({
        user_username: userUsername,
        friend_username: friendUsername,
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Friend added to favorites" }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to add favorite: ${err.message}` },
      { status: 500 }
    );
  }
} 