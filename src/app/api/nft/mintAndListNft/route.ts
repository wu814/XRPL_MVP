import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { mintAndListNFTUSD } from "@/utils/xrpl/nft/nftManager";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { Wallet } from "xrpl";

interface MintAndListNFTRequest {
  businessWallet: {
    classicAddress: string;
  };
  issuerWalletAddress: string;
  uri: string;
  priceUSD: string | number;
  destination?: string | null;
  taxon?: number;
}

export async function POST(req: NextRequest) {
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
    const { businessWallet, issuerWalletAddress, uri, priceUSD, destination, taxon }: MintAndListNFTRequest = await req.json();
    

    // Validate required parameters
    if (!uri || uri.trim() === "") {
      return NextResponse.json(
        { error: "URI is required" },
        { status: 400 }
      );
    }

    if (!priceUSD || isNaN(parseFloat(priceUSD.toString())) || parseFloat(priceUSD.toString()) <= 0) {
      return NextResponse.json(
        { error: "Valid price in USD is required" },
        { status: 400 }
      );
    }

    // Get seed from Supabase using classicAddress
    const supabase = await createSupabaseAnonClient();
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", businessWallet.classicAddress)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json(
        { error: "Wallet not found for the provided classicAddress" },
        { status: 404 },
      );
    }

    const minterWallet = Wallet.fromSeed(walletData.seed);

    // Call the mint and list function
    const result = await mintAndListNFTUSD(
      minterWallet,
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
    console.error(`❌ API Error in mintAndListNFT:`, error instanceof Error ? error.message : 'Unknown error');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { 
        success: false,
        error: `Server error: ${errorMessage}` 
      },
      { status: 500 }
    );
  }
}
