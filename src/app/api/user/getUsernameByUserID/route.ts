import { NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";


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
      .eq("user_id", session.user.user_id)
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch username." },
        { status: 500 },
      );
    }

    return NextResponse.json({ username: data.username }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      {
        error: `Error fetching username: ${errorMessage} [getUsernameByUserID/route.ts]`,
      },
      { status: 500 },
    );
  }
}
