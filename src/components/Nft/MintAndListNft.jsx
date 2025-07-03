"use client";

import { useState } from "react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import { useCurrentUserWallet } from "../Wallet/CurrentUserWalletProvider";
import { useIssuerWallet } from "../Wallet/IssuerWalletProvider";

export default function MintAndListNft() {
  const [uri, setUri] = useState("");
  const [priceUSD, setPriceUSD] = useState("");
  const [destination, setDestination] = useState("");
  const [taxon, setTaxon] = useState("1001");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const { currentUserWallets } = useCurrentUserWallet();
  const { issuerWallets } = useIssuerWallet();

  const businessWallet = currentUserWallets?.find(
    (wallet) => wallet.walletType === "BUSINESS"
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!uri.trim()) {
      setErrorMessage("Please enter a valid URI for the NFT metadata.");
      return;
    }

    if (!priceUSD || isNaN(parseFloat(priceUSD)) || parseFloat(priceUSD) <= 0) {
      setErrorMessage("Please enter a valid price in USD (greater than $0).");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        businessWalletSeed: businessWallet.seed,
        issuerWalletAddress: issuerWallets[0].classicAddress,
        uri: uri.trim(),
        priceUSD: parseFloat(priceUSD),
        destination: destination.trim() || null,
        taxon: parseInt(taxon) || 1001
      };

      console.log("🎫 Submitting NFT mint and list request...", payload);

      const response = await fetch("/api/nft/mintAndListNft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Mint and list failed");
      }

      if (result.success) {
        const data = result.data;
        let message = "🎉 NFT operation completed!";
        
        if (data.workflow === "complete") {
          message = `✅ NFT minted and listed successfully!\n\n🎫 NFT ID: ${data.summary?.nftTokenID}\n💰 Listed for: ${data.summary?.price}\n🆔 Offer ID: ${data.summary?.offerID}`;
        } else if (data.workflow === "partial") {
          message = `⚠️ NFT minted but listing failed!\n\n🎫 NFT ID: ${data.nft?.nftTokenID}\n❌ Listing Error: ${data.sellOffer?.error}`;
        }

        setSuccessMessage(message);
        
        // Clear form on success
        setUri("");
        setPriceUSD("");
        setDestination("");
        setTaxon("1001");
      } else {
        throw new Error(result.error || "Operation failed");
      }
    } catch (error) {
      console.error("❌ Mint and list error:", error);
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-color2 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-primary mb-6">
          Mint & List NFT
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* URI Input */}
          <div>
            <label className="block text-sm text-mutedText mb-1">
              Metadata URI *
            </label>
            <input
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              placeholder="https://yourdomain.com/metadata/nft.json"
              className="w-full bg-color3 border border-transparent rounded-lg p-3 hover:border-primary focus:border-primary focus:outline-none"
              required
            />
          </div>

          {/* Price Input */}
          <div>
            <label className="block text-sm text-mutedText mb-1">
              Price (USD) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={priceUSD}
              onChange={(e) => setPriceUSD(e.target.value)}
              placeholder="10.00"
              className="w-full bg-color3 border border-transparent rounded-lg p-3 hover:border-primary focus:border-primary focus:outline-none"
              required
            />
            <p className="text-xs text-mutedText mt-1">
              List price in USD (e.g., 10.00 for $10)
            </p>
          </div>

          {/* Destination (Optional) */}
          <div>
            <label className="block text-sm text-mutedText mb-1">
              Destination Address (Optional)
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              className="w-full bg-color3 border border-transparent rounded-lg p-3 hover:border-primary focus:border-primary focus:outline-none"
            />
            <p className="text-xs text-mutedText mt-1">
              Lock the offer to a specific wallet address (leave empty for public listing)
            </p>
          </div>

          {/* Taxon */}
          <div>
            <label className="block text-sm text-mutedText mb-1">
              NFT Taxon
            </label>
            <input
              type="number"
              value={taxon}
              onChange={(e) => setTaxon(e.target.value)}
              placeholder="1001"
              className="w-full bg-color3 border border-transparent rounded-lg p-3 hover:border-primary focus:border-primary focus:outline-none"
            />
            <p className="text-xs text-mutedText mt-1">
              NFT collection identifier (1001 = Receipt NFTs)
            </p>
          </div>

          {/* Price Preview */}
          {priceUSD && !isNaN(parseFloat(priceUSD)) && (
            <div className="bg-color3 rounded-lg p-3">
              <p className="text-sm text-mutedText">Listing Preview:</p>
              <p className="text-lg font-semibold text-primary">
                ${parseFloat(priceUSD).toFixed(2)} USD
              </p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? "Processing..." : "🎫 Mint & List NFT"}
          </Button>

          {/* Info Text */}
          <div className="text-xs text-mutedText text-center">
            <p>🏢 Business wallets mint NFTs and list them on DEX for USD</p>
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
