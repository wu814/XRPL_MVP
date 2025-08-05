"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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

    if (!businessWallet) {
      setErrorMessage("No business wallet found. Please create a wallet first.");
      return;
    }

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
        businessWallet,
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
        setSuccessMessage(result.message);
        
        // Clear form on success
        setUri("");
        setPriceUSD("");
        setDestination("");
        setTaxon("1001");
      } else {
        throw new Error(result.error || "Operation failed");
      }
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-color2 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-6">
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
              placeholder="Enter your metadata URI"
              className="w-full bg-color3 border border-transparent rounded-lg p-3 hover:border-gray-500 focus:border-primary focus:outline-none"
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
              step="0.000001"
              min="0.01"
              value={priceUSD}
              onChange={(e) => setPriceUSD(e.target.value)}
              placeholder="0.00"
              className="w-full bg-color3 border border-transparent rounded-lg p-3 hover:border-gray-500 focus:border-primary focus:outline-none"
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
              placeholder="Enter destination address"
              className="w-full bg-color3 border border-transparent rounded-lg p-3 hover:border-gray-500 focus:border-primary focus:outline-none"
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
              step="0.000001"
              value={taxon}
              onChange={(e) => setTaxon(e.target.value)}
              placeholder="1001"
              className="w-full bg-color3 border border-transparent rounded-lg p-3 hover:border-gray-500 focus:border-primary focus:outline-none"
            />
            <p className="text-xs text-mutedText mt-1">
              NFT collection identifier
            </p>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <div className="flex items-center justify-center space-x-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Processing...</span>
              </div>
            ) : (
              "Mint & List NFT"
            )}
          </Button>

          {/* Info Text */}
          <div className="text-xs text-mutedText text-center">
            <p>Business wallets mint NFTs and list them on DEX for USD</p>
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
