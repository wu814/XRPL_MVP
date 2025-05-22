import { NextResponse } from "next/server";
import sendIOU from "@/utils/xrpl/transaction/sendIOU";

export async function POST(req) {
  try {
    const {
      senderWallet,
      recipientAddress,
      amount,
      currency,
      issuerWallets,
      destinationTag,
    } = await req.json();

    if (
      !senderWallet ||
      !recipientAddress ||
      !amount ||
      !currency ||
      !issuerWallets
    ) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 },
      );
    }

    const result = await sendIOU(
      senderWallet,
      recipientAddress,
      amount,
      currency,
      issuerWallets,
      destinationTag ?? null,
    );

    return NextResponse.json({ message: result.message }, { status: 200 });
  } catch (error) {
    console.error("Error in /api/transactions/sendIOU:", error);
    return NextResponse.json(
      { error: `sendIOU failed: ${error.message}` },
      { status: 500 },
    );
  }
}
