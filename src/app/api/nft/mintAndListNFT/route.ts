import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";

import { mintAndListNFTUSD } from "@/utils/xrpl/nft/nftManager";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { Wallet } from "xrpl";
import { APIResponse, MintAndListNFTAPIRequest } from "@/types/apiTypes";

export async function POST(req: NextRequest): Promise<NextResponse<APIResponse<never>>> {  
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json<APIResponse<never>>(
          { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse request body
    const { userWallet, issuerWalletAddress, uri, priceUSD, destination, taxon }: MintAndListNFTAPIRequest = await req.json();
    

    // Validate required parameters
    if (!uri || uri.trim() === "") {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "URI is required" },
        { status: 400 }
      );
    }

    if (!priceUSD || isNaN(parseFloat(priceUSD.toString())) || parseFloat(priceUSD.toString()) <= 0) {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Valid price in USD is required" },
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
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: "Wallet not found for the provided classicAddress" },
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
      taxon
    );

    if (result.success) {
      console.log(`✅ NFT mint and list successful!`);
      return NextResponse.json<APIResponse<never>>({
        success: true,
        message: result.message,
      }, { status: 200 });
    } else {
      return NextResponse.json<APIResponse<never>>(
        { success: false, message: result.error?.message || "NFT mint and list failed" },
        { status: 400 }
      );
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIResponse<never>>  (
      { 
        success: false,
        message: `Server error: ${errorMessage}` 
      },
      { status: 500 }
    );
  }
}
