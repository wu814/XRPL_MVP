import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";

export async function PUT(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = await req.json();
  if (
    typeof username !== "string" ||
    username.trim() === "" ||
    /\s/.test(username)
  ) {
    return NextResponse.json(
      { error: "Username must be non-empty and contain no spaces." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createSupabaseAnonClient();
    const { data, error } = await supabase
      .from("users")
      .update({ username: username })
      .eq("email_address", session.user.email);

    if (error) {
      // Postgres unique violation error code is 23505
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This username is already taken." },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: "Failed to update username." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: "Username updated successfully!" },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: `Error updating username: ${error.message} [updateUserName/route.js]`,
      },
      { status: 500 },
    );
  }
}
