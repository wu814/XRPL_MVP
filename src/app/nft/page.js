"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import BuyNft from "@/components/Nft/BuyNft";
import MintAndListNft from "@/components/Nft/MintAndListNft";
import TradePanel from "@/components/Smart/TradePanel";
import { CurrentUserWalletProvider } from "@/components/Wallet/CurrentUserWalletProvider";
import { IssuerWalletProvider } from "@/components/Wallet/IssuerWalletProvider";

export default function NftPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return; // Still loading
    if (!session) {
      router.push("/"); // Redirect to login if not authenticated
      return;
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-color1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-mutedText mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect
  }

  const isBusiness = session.user.role === "BUSINESS";

  return (
    <CurrentUserWalletProvider>
      <IssuerWalletProvider>
        <div className="min-h-screen bg-color1">          
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto">
              {/* Page Title */}
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-primary mb-2">
                  🎨 NFT Marketplace
                </h1>
                <p className="text-mutedText">
                  {isBusiness 
                    ? "Create and list your NFTs on the XRPL DEX" 
                    : "Purchase NFTs with smart currency conversion"
                  }
                </p>
              </div>

              {/* Role-based Content */}
              <div className="flex justify-center">
                {isBusiness ? (
                  <div className="w-full max-w-lg">
                    <div className="bg-color2 rounded-lg p-6 mb-6">
                      <h2 className="text-xl font-semibold text-primary mb-3">
                        🏢 Business Features
                      </h2>
                      <ul className="text-sm text-mutedText space-y-2">
                        <li>• Mint NFTs with custom metadata</li>
                        <li>• Automatically list on XRPL DEX for USD</li>
                        <li>• Set custom pricing and destination locks</li>
                        <li>• Receipt NFTs for business transactions</li>
                      </ul>
                    </div>
                    <MintAndListNft />
                  </div>
                ) : (
                  <div className="w-full max-w-lg">
                    <div className="bg-color2 rounded-lg p-6 mb-6">
                      <h2 className="text-xl font-semibold text-primary mb-3">
                        👤 User Features
                      </h2>
                      <ul className="text-sm text-mutedText space-y-2">
                        <li>• Purchase NFTs with any supported currency</li>
                        <li>• Automatic smart currency conversion</li>
                        <li>• Pay with XRP, USD, EUR, BTC, ETH, or SOL</li>
                        <li>• Seamless cross-currency transactions</li>
                      </ul>
                    </div>
                    <BuyNft />
                  </div>
                )}
              </div>

              {/* Additional Info */}
              <div className="mt-12 text-center">
                <div className="bg-color2 rounded-lg p-6 max-w-2xl mx-auto">
                  <h3 className="text-lg font-semibold text-primary mb-3">
                    📋 How It Works
                  </h3>
                  {isBusiness ? (
                    <div className="text-sm text-mutedText space-y-2">
                      <p>1. 🎫 Create your NFT with metadata URI and USD price</p>
                      <p>2. 🏭 Business wallet automatically mints the NFT</p>
                      <p>3. 💰 NFT is immediately listed on XRPL DEX for USD</p>
                      <p>4. 🛒 Users can purchase with any supported currency</p>
                    </div>
                  ) : (
                    <div className="text-sm text-mutedText space-y-2">
                      <p>1. 🔍 Find an NFT Offer ID from the marketplace</p>
                      <p>2. 💰 Choose your preferred payment currency</p>
                      <p>3. 🔄 Smart system handles currency conversion automatically</p>
                      <p>4. 🎉 NFT is transferred to your wallet upon payment</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <TradePanel />
          </div>
        </div>
      </IssuerWalletProvider>
    </CurrentUserWalletProvider>
  );
}
