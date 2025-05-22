import { NextResponse } from "next/server";
import getAmmInfo from "@/utils/xrpl/amm/getAmmInfo";

export async function POST(req) {
  try {
    const { asset1, asset2, asset1Issuer, asset2Issuer } = await req.json();

    if (!asset1) {
      return NextResponse.json(
        { error: "Missing required parameter: asset1" },
        { status: 400 },
      );
    }

    const ammInfo = await getAmmInfo(
      asset1,
      asset2,
      asset1Issuer,
      asset2Issuer,
    );

    return NextResponse.json({ data: ammInfo }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: `getAmmInfo error: ${error.message}` },
      { status: 500 },
    );
  }
}
