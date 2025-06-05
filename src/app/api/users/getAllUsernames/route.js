import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createSupabaseAnonClient();

    const { data, error } = await supabase.from("users").select("username");

    if (error) throw error;

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Error fetching users: ${error.message} [getAllUsers/route.js]`,
      },
      { status: 500 },
    );
  }
}
