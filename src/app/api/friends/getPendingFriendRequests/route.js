import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.user_id;
    console.log("🔍 Fetching pending friend requests for user:", userId);
    const supabase = await createSupabaseAnonClient();

    const { data, error } = await supabase
      .from("friend_requests")
      // 
      .select(`
        id,
        sender_id,
        sent_at,
        users:sender_id ( username ) 
      `)
      .eq("receiver_id", userId)
      .eq("status", "pending")
      .order("sent_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: data ?? [] }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: `Internal Server Error: ${err.message}` },
      { status: 500 }
    );
  }
}
