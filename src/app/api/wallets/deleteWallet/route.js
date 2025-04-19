import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function DELETE(req) {
    try {
        const { classic_address, adminPassword } = await req.json();

        if (!classic_address) {
            return NextResponse.json({ error: "Missing classic_address" }, { status: 400 });

        }

        const supabase = await createSupabaseAnonClient();

        const { data: passwordData, error: passwordError } = await supabase
            .from('passwords') // assuming a table named "passwords"
            .select('admin_password')
            .eq('id', 1)
            .single();

        if (passwordError) {
            throw new Error(passwordError.message);
        }

        // Compare the entered password to the stored hash
        const isMatch = await bcrypt.compare(adminPassword, passwordData.admin_password);
        if (!isMatch) {
            return new Response(JSON.stringify({ error: 'Invalid admin password.' }), {
                status: 403,
                headers: { "Content-Type": "application/json" },
            });
        }

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