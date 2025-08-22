import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";

import { createSupabaseAnonClient } from "@/utils/supabase/server";

interface RespondRequestRequest {
  request_id: string;
  action: "accept" | "reject";
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { request_id, action }: RespondRequestRequest = await req.json(); // action = 'accept' or 'reject'
  const receiver = session.user.username;

  if (!request_id || !["accept", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const supabase = await createSupabaseAnonClient();

  // Verify request exists and user is the receiver
  const { data: request, error: fetchError } = await supabase
    .from("friend_requests")
    .select("*")
    .eq("id", request_id)
    .single();

  if (fetchError || !request || request.receiver !== receiver) {
    return NextResponse.json(
      { error: "Request not found or unauthorized" },
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from("friend_requests")
    .update({
      status: action === "accept" ? "accepted" : "rejected",
      responded_at: new Date().toISOString(),
    })
    .eq("id", request_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { message: `Friend request ${action}ed` },
    { status: 200 },
  );
}
