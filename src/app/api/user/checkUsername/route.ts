import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

interface CheckUsernameRequest {
  username: string;
}

export async function POST(req: NextRequest) {
  try {
    const { username }: CheckUsernameRequest = await req.json();
    
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: `Error checking username: ${errorMessage}` },
      { status: 500 }
    );
  }
}
