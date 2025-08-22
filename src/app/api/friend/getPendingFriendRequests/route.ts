import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";

import { createSupabaseAnonClient } from "@/utils/supabase/server";

interface PendingFriendRequest {
  id: string;
  sender: string;
  sent_at: string;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const receiverName = session.user.username;
    const supabase = await createSupabaseAnonClient();

    const { data, error } = await supabase
      .from("friend_requests")
      .select("id, sender, sent_at")
      .eq("receiver", receiverName)
      .eq("status", "pending")
      .order("sent_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: data ?? [] }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: `Internal Server Error: ${errorMessage}` },
      { status: 500 },
    );
  }
}
