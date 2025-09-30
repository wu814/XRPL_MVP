import { NextRequest, NextResponse } from "next/server";
import { getFormattedAMMInfo } from "@/utils/xrpl/amm/ammUtils";
import { APIResponse, GetFormattedAMMInfoAPIRequest } from "@/types/apiTypes";
import { FormattedAMMInfo } from "@/types/xrpl/ammXRPLTypes";

export async function POST(req: NextRequest): Promise<NextResponse<APIResponse<FormattedAMMInfo>>> {
  try {
    const { account }: GetFormattedAMMInfoAPIRequest = await req.json();

    if (!account) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Missing required parameter: account" },
        { status: 400 },
      );
    }

    const ammInfo = await getFormattedAMMInfo(account);

    return NextResponse.json<APIResponse<FormattedAMMInfo>>(
      { success: true, message: "AMM info fetched successfully", data: ammInfo },
      { status: 200 },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIResponse<never>>(
      { success: false, message: `getFormattedAMMInfo error: ${errorMessage}` },
      { status: 500 },
    );
  }
}
