import { NextResponse } from "next/server";
import { getAllAmmInfo } from "@/utils/xrpl/amm/getAmmInfo";

export async function GET() {
  try {
    const ammData = await getAllAmmInfo();
    // Convert back to array format for API response
    const data = Object.values(ammData);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Error fetching AMMs: ${error.message} [getAllAmms/route.js]`,
      },
      { status: 500 },
    );
  }
}
