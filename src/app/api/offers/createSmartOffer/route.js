import { NextResponse } from "next/server";
import createSmartOffer from "@/utils/xrpl/offer/createSmartOffer";
import { Wallet } from "xrpl";

export async function POST(req) {
  try {
    const {
      sellCurrency,
      sellAmount,
      buyCurrency,
      buyAmount,
      issuerAddress,
      offerCreatorWallet,
      options = {}
    } = await req.json();

    if (!sellCurrency || !sellAmount || !buyCurrency || !buyAmount) {
      return NextResponse.json(
        { error: "Missing required input." },
        { status: 400 },
      );
    }

    // Create wallet from seed
    const wallet = Wallet.fromSeed(offerCreatorWallet.seed);

    // Call the smart offer function
    const result = await createSmartOffer(
      wallet,
      sellCurrency,
      sellAmount,
      buyCurrency,
      buyAmount,
      issuerAddress,
      options
    );

    return NextResponse.json(
      {
        success: result.success,
        sequence: result.sequence,
        message: result.message,
        marketAnalysis: result.marketAnalysis || null,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 