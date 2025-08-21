"use client";

import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { useCurrentUserWallet } from "@/components/wallet/CurrentUserWalletProvider";
import CancelOfferBtn from "./CancelOfferBtn";
import { EnhancedOffer, EnhancedCompletedOffer } from "@/types/xrpl/dexXRPLTypes";
import { APIErrorResponse } from "@/types/api/errorAPITypes";
import { GetUserOffersAPIResponse, GetCompletedOffersAPIResponse } from "@/types/api/dexAPITypes";

// Helper: Convert XRP drops or IOU object to unified format
function parseAsset(asset: any) {
  if (typeof asset === "string") {
    const xrpl = require("xrpl");
    return { currency: "XRP", value: Number(xrpl.dropsToXrp(asset)) };
  }
  return { currency: asset.currency, value: Number(asset.value) };
}

// Helper: Get XRPL explorer URL for transaction
function getExplorerUrl(hash: string) {
  return `https://testnet.xrpl.org/transactions/${hash}`;
}

export default function DisplayUserOffers() {
  const { currentUserWallets } = useCurrentUserWallet();
  const [offers, setOffers] = useState<EnhancedOffer[]>([]);
  const [completedOffers, setCompletedOffers] = useState<EnhancedCompletedOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"offers" | "history">("offers");

  const sourceWallet = currentUserWallets?.find(
    (wallet) =>
      wallet.walletType === "USER" ||
      wallet.walletType === "PATHFIND" ||
      wallet.walletType === "BUSINESS",
  );

  const fetchUserOffers = async () => {
    if (!sourceWallet?.classicAddress) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/dex/getUserOffers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceWallet }),
      });

      if (!response.ok) {
        const errorData: APIErrorResponse = await response.json();
        setErrorMessage(errorData.message);
        return;
      }
      const result: GetUserOffersAPIResponse = await response.json();
      setOffers(result.data);
    } catch (err: any) {
      setErrorMessage(err.message); 
    } finally {
      setLoading(false);
    }
  };

  const fetchCompletedOffers = async () => {
    if (!sourceWallet?.classicAddress) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/dex/getCompletedOffers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceWallet }),
      });

      if (!response.ok) {
        const errorData: APIErrorResponse = await response.json();
        setErrorMessage(errorData.message);
        return;
      }

      const result: GetCompletedOffersAPIResponse = await response.json();
      setCompletedOffers(result.data);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (activeTab === "offers") {
      fetchUserOffers();
    } else {
      fetchCompletedOffers();
    }
  };

  useEffect(() => {
    if (activeTab === "offers") {
      fetchUserOffers();
    } else {
      fetchCompletedOffers();
    }
  }, [sourceWallet, activeTab]);

  return (
    <div className="relative flex h-full flex-col">
      {/* Header with Toggle */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex rounded-full bg-color3 p-1">
          <button
            onClick={() => setActiveTab("offers")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "offers"
                ? "bg-primary/20 text-primary border border-primary"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Active Offers
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "history"
                ? "bg-primary/20 text-primary border border-primary"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Completed Offers
          </button>
        </div>

        {/* 🔁 Refresh Button */}
        <button
          className="transition duration-200 ease-in-out hover:scale-110 focus:outline-none"
          onClick={handleRefresh}
          disabled={!sourceWallet?.classicAddress}
        >
          <RefreshCw
            className={`h-6 w-6 hover:text-primary ${loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Content Area - Flex to fill remaining space */}
      <div className="flex-1 overflow-auto">
        {activeTab === "offers" && (
          <>
            {loading && <p className="text-mutedText">Loading offers...</p>}
            {!loading && errorMessage && (
              <p className="text-red-500">Error: {errorMessage}</p>
            )}
            {!loading &&
              !errorMessage &&
              sourceWallet?.classicAddress &&
              offers?.length === 0 && (
                <p className="text-mutedText">You have no active offers.</p>
              )}

            {!loading && offers && offers.length > 0 && (
              <div className="space-y-1 divide-y divide-gray-700">
                <div className="mb-2 mx-4 grid grid-cols-5 gap-4 px-2 font-semibold text-mutedText">
                  <span>Cancel Offer</span>
                  <span>You Want</span>
                  <span>You Pay</span>
                  <span>Created At</span>
                  <span>Explorer</span>
                </div>
                {offers.map((offer, i) => {
                  const pays = parseAsset(offer.taker_pays);
                  const gets = parseAsset(offer.taker_gets);

                  return (
                    <div
                      key={i}
                      className="mx-4 grid grid-cols-5 gap-4 items-center rounded-lg px-2 py-1 text-sm transition duration-100 ease-in-out hover:bg-color4"
                    >
                      <div className="">
                        <CancelOfferBtn
                          wallet={sourceWallet}
                          offerSequence={offer.seq}
                          onOfferCanceled={fetchUserOffers}
                        />
                      </div>
                      <div className="">
                        {pays.value} {pays.currency}
                      </div>
                      <div className="">
                        {gets.value} {gets.currency}
                      </div>
                      <div className="">
                        {offer.dateTime}
                      </div>
                      <div className="">
                        <a
                          href={getExplorerUrl(offer.creationHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                          <span>View</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === "history" && (
          <>
            {loading && <p className="text-mutedText">Loading completed offers...</p>}
            {!loading && errorMessage && (
              <p className="text-red-500">Error: {errorMessage}</p>
            )}
            {!loading &&
              !errorMessage &&
              sourceWallet?.classicAddress &&
              completedOffers && completedOffers.length === 0 && (
                <p className="text-mutedText">You have no completed offers.</p>
              )}

            {!loading && completedOffers && completedOffers.length > 0 && (
              <div className="space-y-1 divide-y divide-gray-700">
                <div className="mb-2 mx-4 grid grid-cols-5 gap-4 px-2 font-semibold text-mutedText">
                  <span>Status</span>
                  <span>You Wanted</span>
                  <span>You Paid</span>
                  <span>Completed At</span>
                  <span>Explorer</span>
                </div>
                {completedOffers.map((offer, i) => {
                  const pays = parseAsset(offer.takerPays);
                  const gets = parseAsset(offer.takerGets);

                  return (
                    <div
                      key={i}
                      className="mx-4 grid grid-cols-5 gap-4 items-center rounded-lg px-2 py-1 text-sm transition duration-100 ease-in-out hover:bg-color4"
                    >
                      <div className="flex items-center gap-2">
                        {offer.status === "filled" ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className={`capitalize ${
                          offer.status === "filled" ? "text-green-500" : "text-red-500"
                        }`}>
                          {offer.status}
                        </span>
                      </div>
                      <div className="">
                        {gets.value} {gets.currency}
                      </div>
                      <div className="">
                        {pays.value} {pays.currency}
                      </div>
                      <div className="">
                        {offer.completedAtDateTime}
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={getExplorerUrl(offer.createHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                          title="View creation transaction"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span className="text-xs">View</span>
                        </a>
                        {offer.completeHash && offer.completeHash !== offer.createHash && (
                          <a
                            href={getExplorerUrl(offer.completeHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                            title="View completion transaction"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span className="text-xs">Complete</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
