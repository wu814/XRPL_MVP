import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { username } = await req.json();
    
    if (typeof username !== "string" || username.trim() === "" || /\s/.test(username)) {
      return NextResponse.json(
        { error: "Username must be non-empty and contain no spaces." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseAnonClient();
    
    const { data, error } = await supabase
      .from("users")
      .select("username")
      .eq("username", username.trim())
      .maybeSingle();

    if (error) {
      throw error;
    }

    const isAvailable = !data;
    
    return NextResponse.json({ available: isAvailable }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: `Error checking username: ${error.message}` },
      { status: 500 }
    );
  }
} 