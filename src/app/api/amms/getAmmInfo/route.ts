import { NextRequest, NextResponse } from "next/server";
import { getAmmInfo } from "@/utils/xrpl/amm/ammUtils";

interface GetAmmInfoRequest {
  ammAccount: string;
}

interface GetAmmInfoResponse {
  data: any; // You can replace 'any' with a more specific type if available
}

export async function POST(req: NextRequest): Promise<NextResponse<GetAmmInfoResponse | { error: string }>> {
  try {
    const { ammAccount }: GetAmmInfoRequest = await req.json();

    if (!ammAccount) {
      return NextResponse.json(
        { error: "Missing required parameter: ammAccount" },
        { status: 400 },
      );
    }

    const ammInfo = await getAmmInfo(ammAccount);

    return NextResponse.json({ data: ammInfo }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: `getAmmInfo error: ${errorMessage}` },
      { status: 500 },
    );
  }
}
