import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req) {
    try {
        const supabase = await createSupabaseAnonClient();
        const { classic_address, wallet_type, wallet_name, seed, xrp_balance, last_sequence, created_at, updated_at } = await req.json();
        console.log("Received data:", { classic_address, wallet_type, wallet_name, seed, xrp_balance, last_sequence, created_at, updated_at });
        const { data, error } = await supabase
            .from("wallets")
            .insert([{
                classic_address,
                wallet_type,
                wallet_name,
                seed,
                xrp_balance,
                last_sequence,
                created_at,
                updated_at
            }]);

        if (error) throw error;
        return NextResponse.json({ message: `${wallet_type} wallet added`, data }, { status: 201 });
    }
    catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}