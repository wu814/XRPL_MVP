"use client";

import { useState, FormEvent } from "react";
import { Loader2 } from "lucide-react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import CurrencyDropDown from "../currency/CurrencyDropDown";
import { useCurrentUserWallet } from "../wallet/CurrentUserWalletProvider";
import { useIssuerWallet } from "../wallet/IssuerWalletProvider";
import { BuyNFTAPIResponse } from "@/types/api/nftAPITypes";
import { APIErrorResponse } from "@/types/api/errorAPITypes";

export default function BuyNFT() {
  const { currentUserWallets } = useCurrentUserWallet();
  const { issuerWallets } = useIssuerWallet();

  // Get user wallet for payments
  const userWallet = currentUserWallets?.find(
    (wallet) =>
      wallet.walletType === "USER" ||
      wallet.walletType === "BUSINESS" ||
      wallet.walletType === "PATHFIND"
  );

  // Get issuer wallet address
  const issuerWallet = issuerWallets?.[0];

  const [offerID, setOfferID] = useState<string>("");
  const [paymentCurrency, setPaymentCurrency] = useState<string>("USD");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!userWallet) {
      setErrorMessage("No user wallet found. Please create a wallet first.");
      return;
    }

    if (!issuerWallet) {
      setErrorMessage("No issuer wallet found. Please contact support.");
      return;
    }

    if (!offerID.trim()) {
      setErrorMessage("Please enter a valid Offer ID.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        offerID: offerID.trim(),
        paymentCurrency,
        issuerWalletAddress: issuerWallet.classicAddress,
        userWallet
      };

      console.log("🛒 Submitting NFT purchase request...", payload);

      const response = await fetch("/api/nft/buyNFT", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData: APIErrorResponse = await response.json();
        setErrorMessage(errorData.message);
        return;
      }
      const result: BuyNFTAPIResponse = await response.json();

      if (result.message) {
        setSuccessMessage(result.message || "NFT purchased successfully!");
        setOfferID(""); // Clear form on success
      } else {
        setErrorMessage(result.message || "Purchase failed");
        return;
      }
    } catch (error: any) {
      console.error("❌ Purchase error:", error);
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-color2 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-6">
          Buy NFT
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Offer ID Input */}
          <div>
            <label className="block text-sm text-mutedText mb-1">
              Offer ID
            </label>
            <input
              type="text"
              value={offerID}
              onChange={(e) => setOfferID(e.target.value)}
              placeholder="Enter NFT Offer ID..."
              className="w-full bg-color3 border border-transparent rounded-lg p-3 hover:border-gray-500 focus:border-primary focus:outline-none"
              required
            />
            <p className="text-xs text-mutedText mt-1">
              Enter the Offer ID of the NFT you want to purchase
            </p>
          </div>

          {/* Payment Currency Selection */}
          <div className="pb-4">
            <label className="block text-sm text-mutedText mb-1">
              Payment Currency
            </label>
            <CurrencyDropDown
              value={paymentCurrency}
              onChange={setPaymentCurrency}
              dropdownBg="bg-color3"
            />
            <p className="text-xs text-mutedText mt-1">
              Select your preferred payment currency (automatic conversion if needed)
              </p>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading || !userWallet || !issuerWallet || !offerID}
            className="w-full"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Processing Purchase...
              </div>
            ) : (
              "Buy NFT"
            )}
          </Button>

          {/* Info Text */}
          <div className="text-xs text-mutedText text-center">
            <p>💡 Smart conversion will automatically exchange your chosen currency for the NFT's required currency (USD)</p>
          </div>
        </form>
      </div>

      {/* Error Modal */}
      {errorMessage && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}

      {/* Success Modal */}
      {successMessage && (
        <SuccessMdl
          successMessage={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}
    </div>
  );
}
