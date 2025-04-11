import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST() {
    try {
        const supabase = await createSupabaseAnonClient();
        const { data, error } = await supabase.from("trustlines").insert([
            {
                wallet_address: "aaaaaaaaaaaa",
                issuer_address: "aaaaaaaaaaaa",
                currency_code: "USD",
                limit_amount: 1000,
                is_activated: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                is_authorized: false
            },
        ]);

        if (error) throw error;
        return NextResponse.json({ message: "trustline added", data }, { status: 201 });
    }
    catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}