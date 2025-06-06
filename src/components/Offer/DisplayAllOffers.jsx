"use client";

import { useEffect, useState } from "react";
import CurrencyDropDown from "../Currency/CurrencyDropDown";
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
    <div className="flex justify-between rounded-lg bg-color3 p-2 px-6 text-sm">
      <div>
        {price} {pays.currency} per {gets.currency}
      </div>
      <div>
        {quantity} {gets.currency}
      </div>
    </div>
  );
};

export default function DisplayAllOffers() {
  const { issuerWallets } = useIssuerWallet();
  const [baseCurrency, setBaseCurrency] = useState(null);
  const [counterCurrency, setCounterCurrency] = useState(null);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const fetchOffers = async () => {
    if (!baseCurrency || !counterCurrency || baseCurrency === counterCurrency) return;

    setLoading(true);
    try {
      const res = await fetch("/api/offers/getAllOffers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseCurrency,
          counterCurrency,
          baseIssuerAddress: issuerWallets[0].classicAddress,
          counterIssuerAddress: issuerWallets[0].classicAddress,
        }),
      });

      const result = await res.json();
      if (res.ok) {
        setOffers(result.offers);
        setSearched(true);
      } else {
        console.error("API error:", result.error);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, [baseCurrency, counterCurrency]);

  return (
    <div className="relative p-4">
      <h1 className="mb-4 text-center text-2xl font-bold">Offer List</h1>

      {/* 🔁 Refresh Button */}
      <button
        className="absolute right-4 top-4 transition duration-200 ease-in-out hover:scale-110"
        onClick={fetchOffers}
        disabled={!baseCurrency || !counterCurrency || baseCurrency === counterCurrency}
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

      {/* Currency Selectors */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm">Currency You Pay</label>
          <CurrencyDropDown
            value={baseCurrency}
            onChange={setBaseCurrency}
            dropdownBg="bg-color3"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm">Currency You Want</label>
          <CurrencyDropDown
            value={counterCurrency}
            onChange={setCounterCurrency}
            dropdownBg="bg-color3"
          />
        </div>
      </div>

      {/* Offer Results */}
      <div>
        {loading && <p className="text-mutedText">Loading offers...</p>}
        {!loading && searched && offers.length === 0 && (
          <p className="text-mutedText">No offers found for this pair.</p>
        )}
        {!loading && offers.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between px-6 font-semibold">
              <span>Price</span>
              <span>Quantity</span>
            </div>
            {offers.map((offer, i) => (
              <OfferRow key={i} offer={offer} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
