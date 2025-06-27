"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import TradePanel from "@/components/Smart/TradePanel";
import { CurrentUserWalletProvider } from "@/components/Wallet/CurrentUserWalletProvider";
import { IssuerWalletProvider } from "@/components/Wallet/IssuerWalletProvider";

export default function Trade() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-color1 p-8 ml-64 mr-80">
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
      <div className="min-h-screen bg-color1 p-8 ml-64 mr-80">
        <div className="text-center py-20">
          <h1 className="text-2xl font-bold text-gray-400">Please log in to access trading</h1>
        </div>
      </div>
    );
  }

  return (
    <CurrentUserWalletProvider>
      <IssuerWalletProvider>
        <div className="min-h-screen bg-color1 p-3 ml-64 w-full" style={{ maxWidth: 'calc(100vw - 16rem - 32rem)' }}>
          {/* Page Header */}
          <div className="mb-4 max-w-full">
            <h1 className="text-2xl font-bold mb-1">Advanced Trading</h1>
            <p className="text-gray-400 text-sm">Choose your preferred trading method</p>
          </div>

                {/* Trading Options Content */}
      <div className="max-w-full space-y-6">
        {/* Liquidity Pool */}
        <div className="bg-color2 rounded-lg p-12 w-full">
          <Link href="/trade/amm" className="block hover:bg-color3 transition-colors rounded-lg p-8 -m-8">
            <div className="flex items-center space-x-12">
              {/* Swap Icon - Much Larger */}
              <div className="flex-shrink-0">
                <img 
                  src="/icons/liquidity-pool-swap.png" 
                  alt="Currency Swap" 
                  width="200" 
                  height="200"
                  className="rounded-lg border border-white"
                />
              </div>
              
              {/* Content */}
              <div className="flex-1">
                <h2 className="text-5xl font-bold mb-4 text-white">Liquidity Pools</h2>
                <p className="text-gray-300 text-xl leading-relaxed">
                  Automated-Market-Maker (AMM) based trading with instant swaps
                </p>
              </div>
            </div>
          </Link>
        </div>

        {/* Order Book */}
        <div className="bg-color2 rounded-lg p-12 w-full">
          <Link href="/trade/dex" className="block hover:bg-color3 transition-colors rounded-lg p-8 -m-8">
            <div className="flex items-center space-x-12">
              {/* Order Book Icon - Much Larger */}
              <div className="flex-shrink-0">
                <img 
                  src="/icons/order-book.png" 
                  alt="Order Book" 
                  width="200" 
                  height="200"
                  className="rounded-lg border border-white"
                />
              </div>
              
              {/* Content */}
              <div className="flex-1">
                <h2 className="text-5xl font-bold mb-4 text-white">Central Limit Order Book</h2>
                <p className="text-gray-300 text-xl leading-relaxed">
                  Traditional trading with limit orders
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>

          {/* Trade Panel - Always visible */}
          <TradePanel user={session.user} session={session} />
        </div>
      </IssuerWalletProvider>
    </CurrentUserWalletProvider>
  );
}
