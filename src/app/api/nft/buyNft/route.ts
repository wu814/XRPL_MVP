import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { purchaseNFTWithSmartTrade } from "@/utils/xrpl/nft/nftManager";
import { Wallet } from "xrpl";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

interface BuyNFTRequest {
  offerID: string;
  paymentCurrency: string;
  issuerWalletAddress: string;
  userWallet: {
    classicAddress: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Parse request body
    const { offerID, paymentCurrency, issuerWalletAddress, userWallet }: BuyNFTRequest =
      await req.json();

    // Validate required parameters
    if (!offerID) {
      return NextResponse.json(
        { error: "Offer ID is required" },
        { status: 400 },
      );
    }

    if (!paymentCurrency) {
      return NextResponse.json(
        { error: "Payment currency is required" },
        { status: 400 },
      );
    }

    if (!issuerWalletAddress) {
      return NextResponse.json(
        { error: "Issuer wallet address is required" },
        { status: 400 },
      );
    }

    if (!userWallet) {
      return NextResponse.json(
        { error: "User wallet is required" },
        { status: 400 },
      );
    }

    // Get seed from Supabase using classicAddress
    const supabase = await createSupabaseAnonClient();
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", userWallet.classicAddress)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json(
        { error: "Wallet not found for the provided classicAddress" },
        { status: 404 },
      );
    }

    const purchaserWallet = Wallet.fromSeed(walletData.seed);

    // Call the purchase function
    const result = await purchaseNFTWithSmartTrade(
      issuerWalletAddress,
      offerID,
      paymentCurrency,
      purchaserWallet,
    );

    if (result.success) {
      console.log(`✅ NFT purchase successful!`);
      return NextResponse.json(
        {
          success: true,
          message: result.message,
        },
        { status: 200 },
      );
    } else {
      console.log(`❌ NFT purchase failed: ${result.error}`);
      return NextResponse.json(
        {
          success: false,
          error: result.error || "NFT purchase failed",
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error(`❌ API Error in buyNFT:`, error instanceof Error ? error.message : 'Unknown error');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      {
        success: false,
        error: `Server error: ${errorMessage}`,
      },
      { status: 500 },
    );
  }
}
