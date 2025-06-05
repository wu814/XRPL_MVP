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

    const receiverName = session.user.username;
    const supabase = await createSupabaseAnonClient();

    const { data, error } = await supabase
      .from("friend_requests")
      //
      .select("id, sender, sent_at")
      .eq("receiver", receiverName)
      .eq("status", "pending")
      .order("sent_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: data ?? [] }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: `Internal Server Error: ${err.message}` },
      { status: 500 },
    );
  }
}
