"use client";

import { useEffect, useState } from "react";
import { useIssuerWallet } from "../Wallet/IssuerWalletProvider";

// Helper: Convert XRP drops or IOU object to unified format
const parseAsset = (asset) => {
  if (typeof asset === "string") {
    return { currency: "XRP", value: Number(asset) / 1_000_000 };
  }
  return { currency: asset.currency, value: Number(asset.value) };
};

// Component to render each offer
const OfferRow = ({ offer }) => {
  const pays = parseAsset(offer.TakerPays);
  const gets = parseAsset(offer.TakerGets);
  const price = (pays.value / gets.value).toFixed(6);
  const quantity = gets.value.toFixed(6);

  return (
    <div className="flex justify-between rounded-lg mx-4 px-2 text-sm">
      <div>
        {price}
      </div>
      <div>
        {quantity}
      </div>
    </div>
  );
};

export default function DisplayAllOffers({ baseCurrency, quoteCurrency }) {
  const { issuerWallets } = useIssuerWallet();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const fetchOffers = async () => {
    if (
      !baseCurrency ||
      !quoteCurrency ||
      baseCurrency === quoteCurrency ||
      !issuerWallets ||
      issuerWallets.length === 0
    )
      return;

    setLoading(true);
    setSearched(false);
    try {
      const res = await fetch("/api/offers/getAllOffers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseCurrency,
          quoteCurrency,
          baseIssuerAddress: issuerWallets[0].classicAddress,
          quoteIssuerAddress: issuerWallets[0].classicAddress,
        }),
      });

      const result = await res.json();
      if (res.ok) {
        setOffers(result.offers);
      } else {
        console.error("API error:", result.error);
        setOffers([]);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setOffers([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, [baseCurrency, quoteCurrency, issuerWallets]);

  return (
    <div className="relative p-4">
      <h1 className="mb-4 text-2xl font-bold">Offer List</h1>

      {/* 🔁 Refresh Button */}
      <button
        className="absolute right-4 top-4 transition duration-200 ease-in-out hover:scale-110 focus:outline-none"
        onClick={fetchOffers}
        disabled={loading || !baseCurrency || !quoteCurrency || baseCurrency === quoteCurrency}
      >
        <svg
          className="h-6 w-6 hover:text-primary"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M17.651 7.65a7.131 7.131 0 0 0-12.68 3.15M18.001 4v4h-4m-7.652 8.35a7.13 7.13 0 0 0 12.68-3.15M6 20v-4h4"
          />
        </svg>
      </button>

      {/* Offer Results */}
      <div className="mt-6">
        {loading && <p className="text-mutedText">Loading offers...</p>}
        {!loading && searched && offers.length === 0 && (
          <p className="text-mutedText">No offers found for this pair.</p>
        )}
        {!loading && offers.length > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between px-2 font-semibold text-mutedText">
              <span>Price ({quoteCurrency})</span>
              <span>Quantity ({baseCurrency})</span>
            </div>
            <div className="border-b border-border my-2"></div>
            {offers.map((offer, i) => (
              <OfferRow key={i} offer={offer} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
