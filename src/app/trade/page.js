"use client";

import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function Trade() {
  const linkClass = (path) =>
    `text-3xl font-semibold transition duration-200 ease-in-out hover:scale-105 hover:text-primary pb-6 block`;

  return (
    <div>
      <Navbar />
      <div className="container mx-auto">
        <div className="grid grid-cols-3 gap-10 p- text-center">
          <div className="rounded-xl bg-color2 p-8">
            <Link href="/trade/amm" className={linkClass("/trade/amm")}>
              Liquidity Pool
            </Link>
            <p className="leading-loose">
              Liquidity Pools allow you to swap tokens using Automated Market
              Makers (AMMs), where users provide token pairs into a shared pool
              and prices are determined by a constant product formula. It’s a
              simple and fast way to trade, especially for newer or less
              frequently traded assets, without needing to match with a specific
              buyer or seller. You trade directly with the pool, and prices
              adjust automatically based on supply and demand in the pool.
            </p>
          </div>
          <div className="rounded-xl bg-color2 p-8">
            <Link href="/trade/dex" className={linkClass("/trade/dex")}>
              Order Book
            </Link>
            <p className="leading-loose">
              Order Book trading is the traditional decentralized exchange (DEX)
              method where users place buy and sell offers for tokens. Trades
              occur when matching orders are found — just like on a stock
              exchange. This gives you more control over your price and timing
              but requires a matching counterparty. It’s ideal for
              high-liquidity assets and precise trading strategies.
            </p>
          </div>
          <div className="rounded-xl bg-color2 p-8">
            <Link href="/trade/amm" className={linkClass("/trade/hybrid")}>
              Smart Trade
            </Link>
            <p className="leading-loose">
              Smart Trade automatically finds the best trading route for you by
              checking both Liquidity Pools and Offer Books. It uses XRPL’s
              pathfinding algorithm to combine AMM and DEX liquidity, ensuring
              you get the most efficient trade with the best rate. Whether it's
              one route or multiple hops, Smart Trade intelligently routes your
              transaction to optimize results with minimal effort on your part.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
