import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import authorizeDeposit from "@/utils/xrpl/wallet/authorizeDeposit";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.user_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { treasuryWallet, authorizedAddress } = await req.json();

    if (!treasuryWallet?.seed || !authorizedAddress) {
      return NextResponse.json(
        { error: "Missing wallet or address." },
        { status: 400 },
      );
    }

    const result = await authorizeDeposit(treasuryWallet, authorizedAddress);

    return NextResponse.json({ message: result.message });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to authorize deposit: ${error.message}` },
      { status: 500 },
    );
  }
}
