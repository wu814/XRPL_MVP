import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";
import { RespondFriendRequestAPIRequest, APIResponse } from "@/types/apiTypes";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

export async function POST(req: NextRequest): Promise<NextResponse<APIResponse<never>>> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json<APIResponse<never>>({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { requestId, action }: RespondFriendRequestAPIRequest = await req.json(); // action = 'accept' or 'reject'
  const receiver = session.user.username;

  if (!requestId || !["accept", "reject"].includes(action)) {
    return NextResponse.json<APIResponse<never>>({ success: false, message: "Invalid input" }, { status: 400 });
  }

  const supabase = await createSupabaseAnonClient();

  // Verify request exists and user is the receiver
  const { data: request, error: fetchError } = await supabase
    .from("friend_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchError || !request || request.receiver !== receiver) {
    return NextResponse.json<APIResponse<never>>({ success: false, message: "Request not found or unauthorized" }, { status: 403 });
  }

  const { error } = await supabase
    .from("friend_requests")
    .update({
      status: action === "accept" ? "accepted" : "rejected",
      responded_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) {
    return NextResponse.json<APIResponse<never>>({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json<APIResponse<never>>({ success: true, message: `Friend request ${action}ed` }, { status: 200 });
}
