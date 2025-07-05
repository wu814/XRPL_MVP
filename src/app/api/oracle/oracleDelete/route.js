import { NextResponse } from "next/server";
import { oracleDelete } from "@/utils/xrpl/oracle/oracleDelete";
import { Wallet } from "xrpl";

export async function POST(request) {
  try {
    const { treasuryWallet, oracleDocumentID } = await request.json();

    // Validate required fields
    if (!treasuryWallet || !oracleDocumentID) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create XRPL wallet object
    const wallet = Wallet.fromSeed(treasuryWallet.seed);

    // Delete oracle
    const result = await oracleDelete(wallet, oracleDocumentID);

    return NextResponse.json({
      message: "Oracle deleted successfully!",
      result: result,
    });

  } catch (error) {
    console.error("Error deleting oracle:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete oracle" },
      { status: 500 }
    );
  }
}
