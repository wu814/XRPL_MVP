import { NextRequest, NextResponse } from "next/server";
import { getFormattedAMMInfo } from "@/utils/xrpl/amm/ammUtils";
import { GetFormattedAMMInfoAPIRequest, GetFormattedAMMInfoAPIResponse } from "@/types/api/ammAPITypes";
import { APIErrorResponse } from "@/types/api/errorAPITypes";

export async function POST(req: NextRequest): Promise<NextResponse<GetFormattedAMMInfoAPIResponse | APIErrorResponse>> {
  try {
    const { account }: GetFormattedAMMInfoAPIRequest = await req.json();

    if (!account) {
      return NextResponse.json<APIErrorResponse>(
        { message: "Missing required parameter: account" },
        { status: 400 },
      );
    }

    const ammInfo = await getFormattedAMMInfo(account);

    return NextResponse.json<GetFormattedAMMInfoAPIResponse>({ message: "AMM info fetched successfully", data: ammInfo }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIErrorResponse>(
      { message: `getFormattedAMMInfo error: ${errorMessage}` },
      { status: 500 },
    );
  }
}
