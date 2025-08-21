"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

import usePageTitle from "@/utils/usePageTitle";

export default function Trade() {
  const { data: session, status } = useSession();

  // Set dynamic page title
  usePageTitle("Trade - YONA");

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-color1 p-8">
        <div className="animate-pulse">
          <div className="mb-8 h-8 w-48 rounded bg-gray-600"></div>
          <div className="mb-6 h-32 rounded bg-gray-600"></div>
          <div className="h-64 rounded bg-gray-600"></div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-color1 p-8">
        <div className="py-20 text-center">
          <h1 className="text-2xl font-bold text-gray-400">
            Please log in to access trading
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full p-2">
      {/* Trading Options Content */}
      <div className="space-y-2">
        {/* Liquidity Pool */}
        <div className="w-full rounded-lg border-gray-700 bg-color2 p-12">
          <Link
            href="/trade/amm"
            className="-m-8 block rounded-lg p-8 transition-colors hover:bg-color3"
          >
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
                <h2 className="mb-4 text-5xl font-bold text-white">
                  Liquidity Pools
                </h2>
                <p className="text-xl leading-relaxed text-gray-300">
                  Automated-Market-Maker (AMM) based trading with instant swaps
                </p>
              </div>
            </div>
          </Link>
        </div>

        {/* Order Book */}
        <div className="w-full rounded-lg bg-color2 p-12">
          <Link
            href="/trade/dex"
            className="-m-8 block rounded-lg p-8 transition-colors hover:bg-color3"
          >
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
                <h2 className="mb-4 text-5xl font-bold text-white">
                  Central Limit Order Book
                </h2>
                <p className="text-xl leading-relaxed text-gray-300">
                  Traditional trading with limit orders
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
