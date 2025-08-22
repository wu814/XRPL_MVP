import { NextResponse } from "next/server";
import { getAllAMMData } from "@/utils/xrpl/amm/ammUtils";
import { GetAllAMMDataAPIResponse } from "@/types/api/ammAPITypes";
import { APIErrorResponse } from "@/types/api/errorAPITypes";

export async function GET(): Promise<NextResponse<GetAllAMMDataAPIResponse | APIErrorResponse>> {
  try {
    const ammData = await getAllAMMData();
    if (!ammData) {
      return NextResponse.json<APIErrorResponse>({ message: "No AMMs found" }, { status: 404 });
    }
    return NextResponse.json<GetAllAMMDataAPIResponse>({ message: "AMMs fetched successfully", data: ammData }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIErrorResponse>({ message: `Error fetching AMMs: ${errorMessage} [getAllAMMData/route.ts]` }, { status: 500 });
  }
}
