import { NextRequest, NextResponse } from "next/server";
import { getAMMInfo } from "@/utils/xrpl/amm/ammUtils";
import { GetAMMInfoAPIRequest, GetAMMInfoAPIResponse, APIErrorResponse } from "@/types/api/index";

export async function POST(req: NextRequest): Promise<NextResponse<GetAMMInfoAPIResponse | APIErrorResponse>> {
  try {
    const { account }: GetAMMInfoAPIRequest = await req.json();

    if (!account) {
      return NextResponse.json<APIErrorResponse>(
        { message: "Missing required parameter: account" },
        { status: 400 },
      );
    }

    const ammInfo = await getAMMInfo(account);

    return NextResponse.json<GetAMMInfoAPIResponse>({ message: "AMM info fetched successfully", data: ammInfo }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIErrorResponse>(
      { message: `getAMMInfo error: ${errorMessage}` },
      { status: 500 },
    );
  }
}
