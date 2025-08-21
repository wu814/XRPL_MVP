"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useIssuerWallet } from "../wallet/IssuerWalletProvider";

interface ParsedAsset {
  currency: string;
  value: number;
}

interface Offer {
  TakerPays: string | { currency: string; value: string };
  TakerGets: string | { currency: string; value: string };
}

interface OffersResponse {
  sellOffers?: Offer[];
  buyOffers?: Offer[];
  error?: string;
}

interface OfferRowProps {
  offer: Offer;
  colorClass: string;
  isSell: boolean;
}

interface DisplayAllOffersProps {
  baseCurrency: string;
  quoteCurrency: string;
}


// Helper: Convert XRP drops or IOU object to unified format
const parseAsset = (asset: string | { currency: string; value: string }): ParsedAsset => {
  if (typeof asset === "string") {
    const xrpl = require("xrpl");
    return { currency: "XRP", value: Number(xrpl.dropsToXrp(asset)) };
  }
  return { currency: asset.currency, value: Number(asset.value) };
};

// Helper: Calculate price for sell offer
const getSellOfferPrice = (offer: Offer): number => {
  const pays = parseAsset(offer.TakerPays);
  const gets = parseAsset(offer.TakerGets);
  return pays.value / gets.value;
};

// Component to render each offer
function OfferRow({ offer, colorClass, isSell }: OfferRowProps) {
  const pays = parseAsset(offer.TakerPays);
  const gets = parseAsset(offer.TakerGets);
  const price = isSell
    ? (pays.value / gets.value).toFixed(6)
    : (gets.value / pays.value).toFixed(6);
  const quantity = isSell ? gets.value.toFixed(6) : pays.value.toFixed(6);

  return (
    <div
      className={`flex justify-between rounded-lg px-2 text-sm ${colorClass}`}
    >
      <div>{price}</div>
      <div>{quantity}</div>
    </div>
  );
};

export default function DisplayAllOffers({ baseCurrency, quoteCurrency }: DisplayAllOffersProps) {
  const { issuerWallets } = useIssuerWallet();
  const [sellOffers, setSellOffers] = useState<Offer[]>([]);
  const [buyOffers, setBuyOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searched, setSearched] = useState<boolean>(false);

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
      const res = await fetch("/api/dex/getAllOffers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseCurrency,
          quoteCurrency,
          baseIssuerAddress: issuerWallets[0].classicAddress,
          quoteIssuerAddress: issuerWallets[0].classicAddress,
        }),
      });

      const data: OffersResponse = await res.json();
      if (res.ok) {
        setSellOffers(data.sellOffers || []);
        setBuyOffers(data.buyOffers || []);
      } else {
        console.error("API error:", data.error);
        setSellOffers([]);
        setBuyOffers([]);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setSellOffers([]);
      setBuyOffers([]);
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
        disabled={
          loading ||
          !baseCurrency ||
          !quoteCurrency ||
          baseCurrency === quoteCurrency
        }
      >
        <RefreshCw
          className={`h-6 w-6 hover:text-primary ${loading ? 'animate-spin' : ''}`}
        />
      </button>

      {/* Offer Results */}
      <div className="flex justify-between px-2 font-semibold">
        <span>Price ({quoteCurrency})</span>
        <span>Quantity ({baseCurrency})</span>
      </div>
      <div className="my-2 border-b border-border"></div>
      <div className="mt-6">
        {loading && <p className="text-mutedText">Loading offers...</p>}
        {!loading &&
          searched &&
          sellOffers.length === 0 &&
          buyOffers.length === 0 && (
            <p className="text-mutedText">No offers found for this pair.</p>
          )}

        {/* Sell Offers */}
        {!loading && sellOffers.length > 0 && (
          <div className="mb-6">
            {/* Sort sell offers by price in descending order */}
            {sellOffers
              .slice() // create a shallow copy to avoid mutating state
              .sort((a, b) => getSellOfferPrice(b) - getSellOfferPrice(a))
              .map((offer, i) => (
                <OfferRow
                  key={`sell-${i}`}
                  offer={offer}
                  colorClass="text-red-500"
                  isSell
                />
              ))}
          </div>
        )}
        {/* Buy Offers */}
        {!loading && buyOffers.length > 0 && (
          <div>
            {buyOffers.map((offer, i) => (
              <OfferRow
                key={`buy-${i}`}
                offer={offer}
                colorClass="text-green-500"
                isSell={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
