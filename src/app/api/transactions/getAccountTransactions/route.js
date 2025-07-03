import { NextResponse } from "next/server";
import { getAccountTransactions } from "@/utils/xrpl/transaction/getAccountTransactions";

export async function POST(req) {
  try {
    const { address, wallet, limit = 50, marker } = await req.json();
    
    const result = await getAccountTransactions({ address, wallet, limit, marker });
    
    return NextResponse.json(result, { status: 200 });
    
  } catch (error) {
    console.error("Error fetching account transactions:", error);
    return NextResponse.json(
      { error: `getAccountTransactions failed: ${error.message}` },
      { status: 500 },
    );
  }
} 