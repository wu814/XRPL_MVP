import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req) {
    try {
        const supabase = await createSupabaseAnonClient();
        const { requester_classic_address, issuer_classic_address, currency, limit_amount, is_authorized, is_activated, created_at, updated_at} = await req.json();
        const { data, error } = await supabase.from("trustlines").insert([
            {
                requester_classic_address,
                issuer_classic_address,
                currency,
                limit_amount,
                is_authorized,
                is_activated,
                created_at,
                updated_at
            },
        ]);

        if (error) throw error;
        return NextResponse.json({ message: "trustline added", data }, { status: 201 });
    }
    catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}