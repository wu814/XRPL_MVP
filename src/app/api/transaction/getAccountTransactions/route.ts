import { NextRequest, NextResponse } from "next/server";
import { getAccountTransactions } from "@/utils/xrpl/transaction/getAccountTransactions";
import { GetAccountTransactionsAPIRequest, APIResponse } from "@/types/apiTypes";
import { ProcessedTransaction } from "@/types/xrpl/transactionXRPLTypes";

export async function POST(req: NextRequest): Promise<NextResponse<APIResponse<{transactions: ProcessedTransaction[], marker: string | null}>>> {
  try {
    const { targetAddress, limit = 50, marker }: GetAccountTransactionsAPIRequest = await req.json();
    
    const result = await getAccountTransactions( targetAddress, limit, marker );
    
    return NextResponse.json({ success: true, message: "Account transactions fetched successfully", data: result }, { status: 200 });
    
  } catch (error) {
    console.error("Error fetching account transactions:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { success: false, message: `getAccountTransactions failed: ${errorMessage}` },
      { status: 500 },
    );
  }
}
