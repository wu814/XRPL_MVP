import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";

import { purchaseNFTWithSmartTrade } from "@/utils/xrpl/nft/nftManager";
import { Wallet } from "xrpl";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { BuyNFTAPIRequest, BuyNFTAPIResponse } from "@/types/api/nftAPITypes";
import { APIErrorResponse } from "@/types/api/errorAPITypes";

export async function POST(req: NextRequest): Promise<NextResponse<BuyNFTAPIResponse | APIErrorResponse>> {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json<APIErrorResponse>(
        { message: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse request body
    const { offerID, paymentCurrency, issuerWalletAddress, userWallet }: BuyNFTAPIRequest = await req.json();

    // Validate required parameters
    if (!offerID) {
      return NextResponse.json<APIErrorResponse>(
        { message: "Offer ID is required" },
        { status: 400 }
      );
    }

    if (!paymentCurrency) {
      return NextResponse.json<APIErrorResponse>(
        { message: "Payment currency is required" },
        { status: 400 }
      );
    }

    if (!issuerWalletAddress) {
      return NextResponse.json<APIErrorResponse>(
        { message: "Issuer wallet address is required" },
        { status: 400 }
      );
    }

    if (!userWallet) {
      return NextResponse.json<APIErrorResponse>(
        { message: "User wallet is required" },
        { status: 400 }
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
      return NextResponse.json<APIErrorResponse>(
        { message: "Wallet not found for the provided classicAddress" },
        { status: 404 }
      );
    }

    const purchaserXRPLWallet = Wallet.fromSeed(walletData.seed);

    // Call the purchase function
    const result = await purchaseNFTWithSmartTrade(
      issuerWalletAddress,
      offerID,
      paymentCurrency,
      purchaserXRPLWallet,
    );

    if (result.success) {
      console.log(`✅ NFT purchase successful!`);
      return NextResponse.json<BuyNFTAPIResponse>(
        {
          message: result.message,
        },
        { status: 200 },
      );
    } else {
      console.log(`❌ NFT purchase failed: ${result.error}`);
      return NextResponse.json<APIErrorResponse>(
        {
          message: result.message,
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error(`❌ API Error in buyNFT:`, error instanceof Error ? error.message : "Unknown error");
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json<APIErrorResponse>(
      {
        message: `Server error: ${errorMessage}`,
      },
      { status: 500 },
    );
  }
}
