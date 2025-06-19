import { NextResponse } from "next/server";
import { getAmmData } from "@/utils/xrpl/amm/ammUtils";

export async function GET() {
  try {
    const ammData = await getAmmData();
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
