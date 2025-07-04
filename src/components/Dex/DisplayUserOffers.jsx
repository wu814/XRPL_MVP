"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useCurrentUserWallet } from "../Wallet/CurrentUserWalletProvider";
import CancelOfferBtn from "./CancelOfferBtn";

// Helper: Convert XRP drops or IOU object to unified format
const parseAsset = (asset) => {
  if (typeof asset === "string") {
    return { currency: "XRP", value: Number(asset) / 1_000_000 };
  }
  return { currency: asset.currency, value: Number(asset.value) };
};

export default function DisplayUserOffers() {
  const { currentUserWallets } = useCurrentUserWallet();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("offers"); // "offers" or "history"

  const sourceWallet = currentUserWallets?.find(
    (wallet) =>
      wallet.walletType === "USER" ||
      wallet.walletType === "STANDBY PATHFIND" ||
      wallet.walletType === "BUSINESS",
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
    <div className="relative h-full flex flex-col">
      {/* Header with Toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex bg-color3 rounded-lg p-1">
          <button
            onClick={() => setActiveTab("offers")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "offers"
                ? "bg-primary text-black"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Your Offers
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "history"
                ? "bg-primary text-black"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Offer History
          </button>
        </div>

        {/* 🔁 Refresh Button */}
        <button
          className="transition duration-200 ease-in-out hover:scale-110 focus:outline-none"
          onClick={fetchUserOffers}
          disabled={!sourceWallet?.classicAddress}
        >
          <RefreshCw
            className={`h-6 w-6 hover:text-primary ${loading ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {/* Content Area - Flex to fill remaining space */}
      <div className="flex-1 overflow-auto">
        {activeTab === "offers" && (
          <>
            {loading && <p className="text-mutedText">Loading offers...</p>}
            {!loading && error && <p className="text-red-500">Error: {error}</p>}
            {!loading &&
              !error &&
              sourceWallet?.classicAddress &&
              offers.length === 0 && (
                <p className="text-mutedText">You have no active offers.</p>
              )}

            {!loading && offers.length > 0 && (
              <div className="space-y-1">
                <div className="mx-4 flex justify-between px-2 font-semibold text-mutedText">
                  <span>You Pay</span>
                  <span>You Want</span>
                </div>
                <div className="my-2 border-b border-border"></div>
                {offers.map((offer, i) => {
                  const pays = parseAsset(offer.taker_pays);
                  const gets = parseAsset(offer.taker_gets);

                  return (
                    <div
                      key={i}
                      className="mx-4 flex justify-between rounded-lg px-2 text-sm transition duration-100 ease-in-out hover:bg-color4"
                    >
                      <div>
                        {gets.value} {gets.currency}
                      </div>
                      <div className="flex items-center gap-2">
                        {pays.value} {pays.currency}
                        <CancelOfferBtn
                          wallet={sourceWallet}
                          offerSequence={offer.seq}
                          onOfferCanceled={fetchUserOffers}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === "history" && (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-lg font-medium">Offer History</p>
              <p className="text-sm mt-2">Your completed and cancelled offers will appear here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
