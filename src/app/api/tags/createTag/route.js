import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.user_id) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    const supabase = await createSupabaseAnonClient();

    const { currency } = await req.json();

    try {
        const { data, error } = await supabase
            .from("tags")
            .insert([
                {
                    user_id: session.user.user_id,
                    tag: session.user.user_id,
                    currency: currency,
                    balance: 0,
                    created_at: new Date().toISOString()
                },
            ])
            .select("id, tag, currency, balance")
            .eq("user_id", session.user.user_id)

        if (error) {
            throw new Error(error.message);
        }

        return NextResponse.json({ data }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}