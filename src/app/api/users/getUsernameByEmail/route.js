import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createSupabaseAnonClient();
    const { data, error } = await supabase
      .from("users")
      .select("username")
      .eq("email_address", session.user.email)
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch username." },
        { status: 500 },
      );
    }

    return NextResponse.json({ username: data.username }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: `Error fetching username: ${error.message} [getUsernameByEmail/route.js]` },
      { status: 500 },
    );
  }
}
