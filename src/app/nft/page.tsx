"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import BuyNft from "@/components/Nft/BuyNft";
import MintAndListNft from "@/components/Nft/MintAndListNft";
// Remove this line: import TradePanel from "@/components/Smart/TradePanel";

import usePageTitle from "@/utils/usePageTitle";

export default function NftPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Set page title
  usePageTitle("NFT Marketplace - YONA");

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
    <div className="min-h-screen bg-color1">          
        <div className="max-w-4xl mx-auto pt-10">
          {/* Role-based Content */}
          <div className="flex justify-center">
            {isBusiness ? (
              <div className="w-full max-w-lg">
                <MintAndListNft />
              </div>
            ) : (
              <div className="w-full max-w-lg">
                <BuyNft />
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
