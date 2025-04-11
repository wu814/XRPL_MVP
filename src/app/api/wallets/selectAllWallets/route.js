import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const supabase = await createSupabaseAnonClient();

        const { data, error } = await supabase.from("wallets").select("classic_address, wallet_type, xrp_balance");

        if (error) throw error;

        return NextResponse.json({ data }, { status: 200 });
    }
    catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
