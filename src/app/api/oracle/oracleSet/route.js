import { NextResponse } from "next/server";
import { createLiveCryptoOracle } from "@/utils/xrpl/oracle/orcaleSet";
import { Wallet } from "xrpl";

export async function POST(request) {
  try {
    const { treasuryWallet, oracleDocumentID, coinGeckoIDs, vsCurrency } = await request.json();

    // Validate required fields
    if (!treasuryWallet || !oracleDocumentID || !coinGeckoIDs || !vsCurrency) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create XRPL wallet object
    const wallet = Wallet.fromSeed(treasuryWallet.seed);

    // Create oracle with live crypto prices
    const result = await createLiveCryptoOracle(
      wallet,
      oracleDocumentID,
      coinGeckoIDs,
      vsCurrency
    );

    return NextResponse.json({
      message: "Oracle set successfully!",
      result: result,
    });

  } catch (error) {
    console.error("Error setting oracle:", error);
    return NextResponse.json(
      { error: error.message || "Failed to set oracle" },
      { status: 500 }
    );
  }
}
