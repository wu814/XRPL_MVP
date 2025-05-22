import { NextResponse } from "next/server";
import sendXRP from "@/utils/xrpl/transaction/sendXRP";

export async function POST(req) {
  try {
    const { senderWallet, recipientAddress, amount, destinationTag } =
      await req.json();

    if (!senderWallet || !recipientAddress || !amount) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 },
      );
    }

    const result = await sendXRP(
      senderWallet,
      recipientAddress,
      amount,
      destinationTag,
    );
    return NextResponse.json({ message: result.message }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
