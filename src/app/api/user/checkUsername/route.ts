import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { CheckUsernameAPIRequest, APIResponse } from "@/types/apiTypes";


export async function POST(req: NextRequest): Promise<NextResponse<APIResponse<{available: boolean}>>> {
  try {
    const { username }: CheckUsernameAPIRequest = await req.json();

    if (typeof username !== "string" || username.trim() === "" || /\s/.test(username)) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Username must be non-empty and contain no spaces." },
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
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Failed to check username" },
        { status: 500 }
      );
    }

    const isAvailable = !data;
    
    return NextResponse.json<APIResponse<{ available: boolean }>>({ success: true, message: "Username checked successfully", data: { available: isAvailable } }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIResponse<never>>(
      { success: false, message: `Error checking username: ${errorMessage}` },
      { status: 500 }
    );
  }
}
