"use client";

import { useState } from "react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import CurrencyDropDown from "../Currency/CurrencyDropDown";
import { useCurrentUserWallet } from "../Wallet/CurrentUserWalletProvider";
import { useIssuerWallet } from "../Wallet/IssuerWalletProvider";

export default function BuyNft() {
  const { currentUserWallets } = useCurrentUserWallet();
  const { issuerWallets } = useIssuerWallet();

  // Get user wallet for payments
  const userWallet = currentUserWallets?.find(
    (wallet) =>
      wallet.walletType === "USER" ||
      wallet.walletType === "BUSINESS" ||
      wallet.walletType === "STANDBY PATHFIND"
  );

  // Get issuer wallet address
  const issuerWallet = issuerWallets?.[0];

  const [offerID, setOfferID] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState("USD");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleSubmit = async (e) => {
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
        userWalletSeed: userWallet.seed
      };

      console.log("🛒 Submitting NFT purchase request...", payload);

      const response = await fetch("/api/nft/buyNft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Purchase failed");
      }

      if (result.success) {
        const data = result.data;
        let message = "🎉 NFT purchased successfully!";
        
        if (data.conversionUsed) {
          message += `\n💱 Currency conversion completed: ${data.amounts?.inputUsed} ${data.paymentCurrency} → ${data.amounts?.amountDelivered} ${data.nftCurrency}`;
        }
        
        if (data.nftTransactionHash) {
          message += `\n📋 Transaction: ${data.nftTransactionHash}`;
        }

        setSuccessMessage(message);
        setOfferID(""); // Clear form on success
      } else {
        throw new Error(result.error || "Purchase failed");
      }
    } catch (error) {
      console.error("❌ Purchase error:", error);
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-color4 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-primary mb-6 text-center">
          🛒 Buy NFT
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
              className="w-full bg-color3 border border-transparent rounded-lg p-3 hover:border-primary focus:border-primary focus:outline-none"
              required
            />
            <p className="text-xs text-mutedText mt-1">
              Enter the Offer ID of the NFT you want to purchase
            </p>
          </div>

          {/* Payment Currency Selection */}
          <div>
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

          {/* Wallet Info Display */}
          {userWallet && (
            <div className="bg-color3 rounded-lg p-3">
              <p className="text-xs text-mutedText">Payment Wallet:</p>
              <p className="text-sm font-mono">{userWallet.classicAddress}</p>
              <p className="text-xs text-mutedText">Type: {userWallet.walletType}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading || !userWallet || !issuerWallet}
            className="w-full"
          >
            {loading ? "Processing Purchase..." : "🛒 Buy NFT"}
          </Button>

          {/* Info Text */}
          <div className="text-xs text-mutedText text-center">
            <p>💡 Smart conversion will automatically exchange your chosen currency for the NFT's required currency</p>
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
