import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { purchaseNFTWithSmartTrade } from "@/utils/xrpl/pos/nftManager";

export async function POST(req) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse request body
    const { offerID, paymentCurrency, issuerWalletAddress, userWalletSeed } = await req.json();

    // Validate required parameters
    if (!offerID) {
      return NextResponse.json(
        { error: "Offer ID is required" },
        { status: 400 }
      );
    }

    if (!paymentCurrency) {
      return NextResponse.json(
        { error: "Payment currency is required" },
        { status: 400 }
      );
    }

    if (!issuerWalletAddress) {
      return NextResponse.json(
        { error: "Issuer wallet address is required" },
        { status: 400 }
      );
    }

    if (!userWalletSeed) {
      return NextResponse.json(
        { error: "User wallet seed is required" },
        { status: 400 }
      );
    }

    console.log(`🛒 Processing NFT purchase request...`);
    console.log(`   👤 User: ${session.user.username}`);
    console.log(`   🆔 Offer ID: ${offerID}`);
    console.log(`   💰 Payment Currency: ${paymentCurrency}`);

    // Call the purchase function
    const result = await purchaseNFTWithSmartTrade(
      issuerWalletAddress,
      offerID,
      paymentCurrency,
      userWalletSeed
    );

    if (result.success) {
      console.log(`✅ NFT purchase successful!`);
      return NextResponse.json({
        success: true,
        message: result.message,
      }, { status: 200 });
    } else {
      console.log(`❌ NFT purchase failed: ${result.error}`);
      return NextResponse.json({
        success: false,
        error: result.error || "NFT purchase failed"
      }, { status: 400 });
    }

  } catch (error) {
    console.error(`❌ API Error in buyNft:`, error.message);
    return NextResponse.json(
      { 
        success: false,
        error: `Server error: ${error.message}` 
      },
      { status: 500 }
    );
  }
}
