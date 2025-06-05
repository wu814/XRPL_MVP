"use client";

import { useEffect, useState } from "react";
import CurrencyDropDown from "../Currency/CurrencyDropDown";
import { useWallet } from "../WalletContext";

export default function DisplayAllOffers() {
  const [baseCurrency, setBaseCurrency] = useState(null);
  const [counterCurrency, setCounterCurrency] = useState(null);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false); // Track if a search has completed

  const { issuerWallets } = useWallet();

  useEffect(() => {
    const fetchOffers = async () => {
      if (!baseCurrency || !counterCurrency || baseCurrency === counterCurrency)
        return;

      setLoading(true);
      try {
        const res = await fetch("/api/offers/getAllOffers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseCurrency,
            counterCurrency,
            baseIssuerAddress: issuerWallets[0].classicAddress, // Replace with dynamic value if needed
            counterIssuerAddress: issuerWallets[0].classicAddress, // Replace with dynamic value if needed
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

    fetchOffers();
  }, [baseCurrency, counterCurrency]);

  return (
    <div className="rounded-lg bg-color2 p-4 text-white">
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="mb-1 block text-sm">Base Currency</label>
          <CurrencyDropDown
            value={baseCurrency}
            onChange={setBaseCurrency}
            dropdownBg={"bg-color3"}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm">Counter Currency</label>
          <CurrencyDropDown
            value={counterCurrency}
            onChange={setCounterCurrency}
            dropdownBg={"bg-color3"}
          />
        </div>
      </div>

      <div>
        {loading ? (
          <p className="text-mutedText">Loading offers...</p>
        ) : searched && offers.length === 0 ? (
          <p className="text-mutedText">No offers found for this pair.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-between px-6 font-semibold">
              <span>Price</span>
              <span>Quantity</span>
            </div>
            {offers.map((offer, i) => {
              const pay = offer.TakerPays;
              const get = offer.TakerGets;

              const parseAsset = (asset) => {
                if (typeof asset === "string") {
                  // XRP in drops
                  return {
                    currency: "XRP",
                    value: Number(asset) / 1_000_000,
                  };
                }
                return {
                  currency: asset.currency,
                  value: Number(asset.value),
                };
              };

              const pays = parseAsset(pay);
              const gets = parseAsset(get);
              const price = (pays.value / gets.value).toFixed(6); // Price per unit of "Gets"
              const quantity = gets.value.toFixed(6); // Quantity offered

              return (
                <div
                  key={i}
                  className="flex justify-between rounded-lg bg-color3 p-4 px-6 text-sm"
                >
                  <div>
                    {price} {pays.currency} per {gets.currency}
                  </div>
                  <div>
                    {quantity} {gets.currency}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
