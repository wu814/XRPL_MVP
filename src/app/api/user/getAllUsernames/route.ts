import { NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseAnonClient();

    const { data, error } = await supabase.from("users").select("username");

    if (error) throw error;

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      {
        error: `Error fetching users: ${errorMessage} [getAllUsers/route.ts]`,
      },
      { status: 500 },
    );
  }
}
