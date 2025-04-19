import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const supabase = await createSupabaseAnonClient();
        const { data, error } = await supabase
            .from("operational_usd")
            .select("tag", "balance")
            .eq("user_id", session.user.user_id);

        if (error) {
            return NextResponse.json(
                { error: "Failed to fetch User USD Account." },
                { status: 500 }
            );
        }

        return NextResponse.json(data, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}