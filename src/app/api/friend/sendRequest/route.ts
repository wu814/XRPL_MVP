import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";

import { createSupabaseAnonClient } from "@/utils/supabase/server";

interface SendRequestRequest {
  receiver: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { receiver }: SendRequestRequest = await req.json();
  const sender = session.user.username;

  if (!receiver || receiver === sender) {
    return NextResponse.json({ error: "Invalid receiver" }, { status: 400 });
  }

  const supabase = await createSupabaseAnonClient();

  // Check for existing friend requests in either direction
  const { data: existing, error: queryError } = await supabase
    .from("friend_requests")
    .select("*")
    .or(
      `and(sender.eq.${sender},receiver.eq.${receiver}),and(sender.eq.${receiver},receiver.eq.${sender})`,
    )
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  if (existing) {
    if (existing.status === "accepted") {
      return NextResponse.json(
        { error: "You are already friends." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: `Friend request already exists (${existing.status})` },
      { status: 409 },
    );
  }

  // Create the friend request
  const { error: insertError } = await supabase.from("friend_requests").insert({
    sender,
    receiver,
    status: "pending",
    sent_at: new Date().toISOString(),
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(
    { message: "Friend request sent!" },
    { status: 200 },
  );
}
