import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.is_admin) {
    try {
      const supabase = await createSupabaseAnonClient();
      const { data, error } = await supabase
        .from("amms")
        .select("*");

      if (error) throw error;

      return NextResponse.json({ data }, { status: 200 });
    } catch (error) {
      return NextResponse.json(
        { error: `${error.message} [getAllAmms/route.js]` },
        { status: 500 }
      );
    }
  }
}