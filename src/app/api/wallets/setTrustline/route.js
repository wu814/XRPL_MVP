import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import setTrustline from "@/utils/xrpl/wallet/setTrustline";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.user_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { setterWallet, issuerWallets, currency } = await req.json();

    if (
      !setterWallet?.seed ||
      !issuerWallets?.[0]?.classicAddress ||
      !currency
    ) {
      return NextResponse.json(
        { error: "Invalid or missing input data." },
        { status: 400 },
      );
    }

    const result = await setTrustline(setterWallet, issuerWallets, currency);

    return NextResponse.json({ message: result.message }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: `Trustline setup failed: ${err.message}` },
      { status: 500 },
    );
  }
}
