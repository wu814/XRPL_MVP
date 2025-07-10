import getCompletedOffers from "@/utils/xrpl/offer/getCompletedOffers";
import { NextResponse } from "next/server";

// POST request handler
export async function POST(req) {
  try {
    const { sourceWallet } = await req.json();

    if (!sourceWallet || !sourceWallet.classicAddress) {
      return NextResponse.json({ error: "Missing Source Wallet address" }, { status: 400 });
    }

    const completedOffers = await getCompletedOffers(sourceWallet);

    return NextResponse.json({ completedOffers }, { status: 200 });
  } catch (error) {
    console.error("API Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 