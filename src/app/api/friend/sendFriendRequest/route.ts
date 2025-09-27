import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";
import { SendFriendRequestAPIRequest, APIResponse } from "@/types/apiTypes";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

export async function POST(req: NextRequest): Promise<NextResponse<APIResponse<never>>> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { receiver }: SendFriendRequestAPIRequest = await req.json();
  const sender = session.user.username;

  if (!receiver || receiver === sender) {
    return NextResponse.json({ success: false, message: "Invalid receiver" }, { status: 400 });
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
    return NextResponse.json({ success: false, message: queryError.message }, { status: 500 });
  }

  if (existing) {
    if (existing.status === "accepted") {
      return NextResponse.json({ success: false, message: "You are already friends." }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: `Friend request already exists (${existing.status})` }, { status: 409 });
  }

  // Create the friend request
  const { error: insertError } = await supabase.from("friend_requests").insert({
    sender,
    receiver,
    status: "pending",
    sent_at: new Date().toISOString(),
  });

  if (insertError) {
    return NextResponse.json({ success: false, message: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Friend request sent!" }, { status: 200 });
}
