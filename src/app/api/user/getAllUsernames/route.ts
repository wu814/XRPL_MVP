import { NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { APIResponse } from "@/types/apiTypes";

export async function GET(): Promise<NextResponse<APIResponse<String[]>>> {
  try {
    const supabase = await createSupabaseAnonClient();

    const { data: userNamesData, error } = await supabase.from("users").select("username");

    if (error) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: `Error fetching users: ${error.message} [getAllUsers/route.ts]` },
        { status: 500 }
      );
    }

    return NextResponse.json<APIResponse<String[]>>({ success: true, message: "Users fetched successfully", data: userNamesData.map((user) => user.username) }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIResponse<never>>(
      {
        success: false, message: `Error fetching users: ${errorMessage} [getAllUsers/route.ts]`,
      },
      { status: 500 },
    );
  }
}
