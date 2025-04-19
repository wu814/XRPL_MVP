import { createSupabaseAnonClient} from "@/utils/supabase/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";

export async function POST(req) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email){
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const supabase = await createSupabaseAnonClient();
        const {data, error} = await supabase.from("operational_usd")
            .insert([{
                user_id: session.user.user_id,
                tag: session.user.user_id,
                balance: 0,
                created_at: new Date().toISOString(),
            }]);
            
        if (error) throw error;
        return NextResponse.json({ message: "USD account created successfully", data }, { status: 201 });
    }
    catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}