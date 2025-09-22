import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { APIResponse } from "@/types/apiTypes";
import { PendingFriendRequest } from "@/types/appTypes";


export async function GET(): Promise<NextResponse<APIResponse<PendingFriendRequest[]>>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json<APIResponse<never>>({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const receiverName = session.user.username;
    const supabase = await createSupabaseAnonClient();

    const { data, error } = await supabase
      .from("friend_requests")
      .select("id, sender, sent_at")
      .eq("receiver", receiverName)
      .eq("status", "pending")
      .order("sent_at", { ascending: false });

    if (error) {
      return NextResponse.json<APIResponse<never>>({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json<APIResponse<PendingFriendRequest[]>>({ success: true, message: "Pending friend requests fetched", data: data.map((request) => ({
      id: request.id,
      sender: request.sender,
      sent_at: request.sent_at,
    })) }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return NextResponse.json<APIResponse<never>>({ success: false, message: `Internal Server Error: ${errorMessage}` }, { status: 500 });
  }
}
