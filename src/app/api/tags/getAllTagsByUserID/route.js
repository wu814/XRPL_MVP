import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {

    try {
        const supabase = await createSupabaseAnonClient();
        const session = await getServerSession(authOptions);
        const { data, error } = await supabase
            .from("tags")
            .select("id, tag , currency, balance")
            .eq("user_id", session.user.user_id);

        if (error) throw error;

        return NextResponse.json({ message: "Tags retrieved successfully", data }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
