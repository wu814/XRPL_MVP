"use client";

import CreateOffer from "@/components/dex/CreateOffer";
import DisplayAllOffers from "@/components/dex/DisplayAllOffers";
import DisplayUserOffers from "@/components/dex/DisplayUserOffers";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import CurrencyPairSelection from "@/components/currency/CurrencyPairSelection";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import usePageTitle from "@/utils/usePageTitle";

export default function DEX() {
  const { data: session, status } = useSession();
  const [baseCurrency, setBaseCurrency] = useState("XRP");
  const [quoteCurrency, setQuoteCurrency] = useState("USD");
  
  // Set page title
  usePageTitle("Order Book - YONA");

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-color1 p-8 ">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-600 rounded w-48 mb-8"></div>
          <div className="h-32 bg-gray-600 rounded mb-6"></div>
          <div className="h-64 bg-gray-600 rounded"></div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-color1 p-8 ">
        <div className="text-center py-20">
          <h1 className="text-2xl font-bold text-gray-400">Please log in to access order book trading</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-color1 p-2">
      {/* Breadcrumbs */}
      <div className="m-2">
        <Breadcrumbs />
      </div>

      {/* Currency Pair Selection */}
      <div className="mb-4">
        <CurrencyPairSelection
          onPairUpdate={(base, quote) => {
            setBaseCurrency(base);
            setQuoteCurrency(quote);
          }}
        />
      </div>

      {/* Main Trading Interface - Full Width */}
      <div className="w-full space-y-2">
        {/* Top Row: Chart and Order Book */}
        <div className="grid grid-cols-4 gap-2">
          <div className="col-span-1 rounded-lg bg-color2 p-4">
            <CreateOffer 
              baseCurrency={baseCurrency}
              quoteCurrency={quoteCurrency}
            />
          </div>
          <div className="col-span-1 rounded-lg bg-color2 p-4">
            <DisplayAllOffers
              baseCurrency={baseCurrency}
              quoteCurrency={quoteCurrency}
            />
          </div>
          <div className="col-span-2 rounded-lg bg-color2 p-4">
            <h2 className="text-xl font-bold mb-4">Price Chart</h2>
            <div className="h-64 flex items-center justify-center text-gray-400">
              Chart visualization coming soon
            </div>
          </div>
        </div>

        {/* Bottom Row: User Orders - Full Width and Height */}
        <div className="rounded-lg bg-color2 p-4 h-[26rem]">
          <DisplayUserOffers />
        </div>
      </div>
    </div>
  );
}
