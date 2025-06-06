"use client";

import { useEffect, useState } from "react";
import { useCurrentUserWallet } from "../Wallet/CurrentUserWalletProvider";

// Helper: Convert XRP drops or IOU object to unified format
const parseAsset = (asset) => {
  if (typeof asset === "string") {
    return { currency: "XRP", value: Number(asset) / 1_000_000 };
  }
  return { currency: asset.currency, value: Number(asset.value) };
};

// Styled row for each user offer
const UserOfferRow = ({ offer }) => {
  const gets = parseAsset(offer.taker_gets);
  const pays = parseAsset(offer.taker_pays);
  const price = (pays.value / gets.value).toFixed(6);
  const quantity = gets.value.toFixed(6);

  return (
    <div className="flex justify-between rounded-lg bg-color3 p-2 px-6 text-sm">
      <div>{price} {pays.currency} per {gets.currency}</div>
      <div>{quantity} {gets.currency}</div>
    </div>
  );
};

export default function DisplayUserOffers() {
  const { currentUserWallets } = useCurrentUserWallet();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sourceWallet = currentUserWallets?.find(
    (wallet) =>
      wallet.walletType === "USER" || wallet.walletType === "STANDBY PATHFIND",
  );

  const fetchUserOffers = async () => {
    if (!sourceWallet?.classicAddress) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/offers/getUserOffers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceWallet }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch offers");

      setOffers(data.offers);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserOffers();
  }, [sourceWallet]);

  return (
    <div className="relative p-4">
      <h1 className="mb-4 text-center text-2xl font-bold">Your Offers</h1>

      {/* 🔁 Refresh Button */}
      <button
        className="absolute right-4 top-4 transition duration-200 ease-in-out hover:scale-110"
        onClick={fetchUserOffers}
        disabled={!sourceWallet?.classicAddress}
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

      {loading && <p className="text-mutedText">Loading offers...</p>}
      {!loading && error && <p className="text-red-500">Error: {error}</p>}
      {!loading && !error && sourceWallet?.classicAddress && offers.length === 0 && (
        <p className="text-mutedText">You have no active offers.</p>
      )}

      {!loading && offers.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between px-6 font-semibold">
            <span>Price</span>
            <span>Quantity</span>
          </div>
          {offers.map((offer, i) => (
            <UserOfferRow key={i} offer={offer} />
          ))}
        </div>
      )}
    </div>
  );
}
