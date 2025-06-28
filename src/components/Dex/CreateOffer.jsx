"use client";

import { useState, useEffect } from "react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import { useCurrentUserWallet } from "../Wallet/CurrentUserWalletProvider";
import { useIssuerWallet } from "../Wallet/IssuerWalletProvider";

const OFFER_TYPES = [
  "Regular",
  "FillOrKill",
  "ImmediateOrCancel",
  "Passive",
  "Sell",
];

export default function CreateOffer({ baseCurrency, quoteCurrency }) {
  // Fetch current user wallets from wallet context
  const { currentUserWallets } = useCurrentUserWallet();
  const { issuerWallets } = useIssuerWallet();

  const offerCreatorWallet = currentUserWallets?.find(
    (wallet) =>
      wallet.walletType === "USER" ||
      wallet.walletType === "BUSINESS" ||
      wallet.walletType === "STANDBY PATHFIND",
  );

  const [orderType, setOrderType] = useState("buy"); // "buy" or "sell"
  const [limitPrice, setLimitPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [offerType, setOfferType] = useState("Regular");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleSubmit = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        offerType,
        orderType,
        baseCurrency,
        quoteCurrency,
        limitPrice: parseFloat(limitPrice),
        quantity: parseFloat(quantity),
        issuerAddress: issuerWallets[0].classicAddress,
        offerCreatorWallet,
      };

      const res = await fetch("/api/offers/createOffer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) throw new Error(result.error || "Offer creation failed");

      // If the offer is not filled, (tecKill of other)
      if (!result.success) {
        setErrorMessage(result.message || "Transaction failed");
      } else {
        setSuccessMessage(result.message || "Offer created successfully!");
        // Clear form on success
        setLimitPrice("");
        setQuantity("");
      }
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="p-4 text-2xl font-bold">Create an Offer</h1>
      <div className="space-y-4 px-4">
        {/* Buy/Sell Toggle */}
        <div className="flex space-x-1 rounded-lg bg-color3 p-1">
          <button
            className={`flex-1 rounded-lg py-2 text-sm transition-colors ${
              orderType === "buy"
                ? "bg-primary text-black"
                : "text-mutedText hover:text-white"
            }`}
            onClick={() => setOrderType("buy")}
          >
            Buy
          </button>
          <button
            className={`flex-1 rounded-lg py-2 text-sm transition-colors ${
              orderType === "sell"
                ? "bg-primary text-black"
                : "text-mutedText hover:text-white"
            }`}
            onClick={() => setOrderType("sell")}
          >
            Sell
          </button>
        </div>

        {/* Limit Price */}
        <div>
          <label className="mb-1 block text-sm text-mutedText">
            Limit Price ({quoteCurrency})
          </label>
          <input
            type="number"
            placeholder="0.00"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            className="w-full rounded-lg border border-transparent bg-color3 p-2 text-right hover:border-primary focus:border-primary focus:outline-none"
          />
        </div>

        {/* Quantity */}
        <div>
          <label className="mb-1 block text-sm text-mutedText">
            Quantity ({baseCurrency})
          </label>
          <input
            type="number"
            placeholder="0.00"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full rounded-lg border border-transparent bg-color3 p-2 text-right hover:border-primary focus:border-primary focus:outline-none"
          />
        </div>

        {/* Total Value Display */}
        {limitPrice && quantity && (
          <div className="rounded-lg bg-color3 p-4">
            <label className="mb-1 block text-sm text-mutedText">
              Total Value
            </label>
            <div className="text-right text-lg font-semibold">
              {(parseFloat(limitPrice) * parseFloat(quantity)).toFixed(2)}{" "}
              {quoteCurrency}
            </div>
          </div>
        )}

        {/* Offer type dropdown */}
        <div>
          <label className="mb-1 block text-sm text-mutedText">
            Offer Type
          </label>
          <select
            className="w-full rounded-lg border border-transparent bg-color3 p-2 hover:border-primary focus:border-primary focus:outline-none"
            value={offerType}
            onChange={(e) => setOfferType(e.target.value)}
          >
            {OFFER_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={loading || !limitPrice || !quantity}
            className="w-full"
          >
            {loading
              ? "Submitting..."
              : `${orderType === "buy" ? "Buy" : "Sell"} ${baseCurrency}`}
          </Button>
        </div>

        {/* Feedback Modals */}
        {errorMessage && (
          <ErrorMdl
            errorMessage={errorMessage}
            onClose={() => setErrorMessage(null)}
          />
        )}
        {successMessage && (
          <SuccessMdl
            successMessage={successMessage}
            onClose={() => setSuccessMessage(null)}
          />
        )}
      </div>
    </div>
  );
}
