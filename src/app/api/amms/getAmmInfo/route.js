import { NextResponse } from "next/server";
import { getAmmInfo } from "@/utils/xrpl/amm/ammUtils";

export async function POST(req) {
  try {
    const { ammAccount } = await req.json();

    if (!ammAccount) {
      return NextResponse.json(
        { error: "Missing required parameter: asset1" },
        { status: 400 },
      );
    }

    const ammInfo = await getAmmInfo(
      ammAccount,
    );

    return NextResponse.json({ data: ammInfo }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: `getAmmInfo error: ${error.message}` },
      { status: 500 },
    );
  }
}
