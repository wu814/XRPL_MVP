// /app/api/friends/sendRequest/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { receiver_id } = await req.json();
  const sender_id = session.user.user_id;

  if (!receiver_id || receiver_id === sender_id) {
    return NextResponse.json({ error: "Invalid receiver ID" }, { status: 400 });
  }

  const supabase = await createSupabaseAnonClient();

  // Prevent duplicate
  const { data: existing } = await supabase
    .from("friend_requests")
    .select("*")
    .or(`sender_id.eq.${sender_id},receiver_id.eq.${receiver_id}`)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Friend request already exists" }, { status: 409 });
  }

  const { error } = await supabase.from("friend_requests").insert({
    sender_id,
    receiver_id,
    status: "pending",
    sent_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Friend request sent!" }, { status: 200 });
}
