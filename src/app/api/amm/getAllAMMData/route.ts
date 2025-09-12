import { NextResponse } from "next/server";
import { getAllAMMData } from "@/utils/xrpl/amm/ammUtils";
import { APIResponse } from "@/types/apiTypes";
import { AMMData } from "@/types/xrpl/ammXRPLTypes";

export async function GET(): Promise<NextResponse<APIResponse<AMMData[]>>> {
  try {
    const ammData = await getAllAMMData();
    if (!ammData) {
      return NextResponse.json<APIResponse<never>>({ success: false, message: "No AMMs found" }, { status: 404 });
    }
    return NextResponse.json<APIResponse<AMMData[]>>({ success: true, message: "AMMs fetched successfully", data: ammData }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIResponse<never>>({ success: false, message: `Error fetching AMMs: ${errorMessage} [getAllAMMData/route.ts]` }, { status: 500 });
  }
}
