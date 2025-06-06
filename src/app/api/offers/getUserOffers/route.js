import getUserOffers from "@/utils/xrpl/offer/getUserOffers";
import { NextResponse } from "next/server";

// POST request handler
export async function POST(req) {
  try {
    const { sourceWallet } = await req.json();

    if (!sourceWallet || !sourceWallet.classicAddress) {
      return NextResponse.json({ error: "Missing Source Wallet address" }, { status: 400 });
    }

    const offers = await getUserOffers(sourceWallet);

    return NextResponse.json({ offers }, { status: 200 });
  } catch (error) {
    console.error("API Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
