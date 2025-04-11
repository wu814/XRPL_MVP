import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(req) {
    try{
        const { classic_address } = await req.json();
    
        if (!classic_address) {
            return NextResponse.json({ error: "Missing classic_address" }, { status: 400 });
    
        }
    
        const supabase = await createSupabaseAnonClient();
    
        const { data, error } = await supabase
            .from("wallets")
            .delete()
            .eq("classic_address", classic_address);

        if (error) throw error;

        return NextResponse.json({ message: "Wallet deleted successfully" });
    }

    catch (error) {
        console.error("Error deleting wallet:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}