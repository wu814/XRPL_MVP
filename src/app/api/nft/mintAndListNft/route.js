import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { mintAndListNFTUSD } from "@/utils/xrpl/pos/nftManager";

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

    // Check if user has BUSINESS role
    if (session.user.role !== "BUSINESS") {
      return NextResponse.json(
        { error: "Only business users can mint and list NFTs" },
        { status: 403 }
      );
    }

    // Parse request body
    const { businessWalletSeed, issuerWalletAddress, uri, priceUSD, destination, taxon } = await req.json();
    

    // Validate required parameters
    if (!uri || uri.trim() === "") {
      return NextResponse.json(
        { error: "URI is required" },
        { status: 400 }
      );
    }

    if (!priceUSD || isNaN(parseFloat(priceUSD)) || parseFloat(priceUSD) <= 0) {
      return NextResponse.json(
        { error: "Valid price in USD is required" },
        { status: 400 }
      );
    }

    console.log(`🎫 Processing NFT mint and list request...`);
    console.log(`   👤 Business User: ${session.user.username}`);
    console.log(`   📄 URI: ${uri}`);
    console.log(`   💵 Price: $${priceUSD} USD`);
    if (destination) {
      console.log(`   🎯 Destination: ${destination}`);
    }

    // Call the mint and list function
    const result = await mintAndListNFTUSD(
      businessWalletSeed,
      issuerWalletAddress,
      uri,
      priceUSD,
      destination || null,
      taxon || 1001 // Default RECEIPT_TAXON
    );

    if (result.success) {
      console.log(`✅ NFT mint and list successful!`);
      return NextResponse.json({
        success: true,
        message: result.message,
      }, { status: 200 });
    } else {
      console.log(`❌ NFT mint and list failed: ${result.error}`);
      return NextResponse.json({
        success: false,
        error: result.error || "NFT mint and list failed"
      }, { status: 400 });
    }

  } catch (error) {
    console.error(`❌ API Error in mintAndListNft:`, error.message);
    return NextResponse.json(
      { 
        success: false,
        error: `Server error: ${error.message}` 
      },
      { status: 500 }
    );
  }
}
