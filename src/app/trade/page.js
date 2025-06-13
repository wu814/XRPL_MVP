"use client";

import Navbar from "@/components/Navigation/Navbar";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function Trade() {
  const { data: session, status } = useSession();
  const [username, setUsername] = useState("");

  const linkClass = (path) =>
    `text-3xl font-semibold transition duration-200 ease-in-out hover:scale-105 hover:text-primary pb-6 block`;

  useEffect(() => {
    if (status === "authenticated") {
      setUsername(session.user.username || "");
    }
  }, [session, status]);

  return (
    <div>
      <Navbar username={username} />
      <div className="container mx-auto">
        <div className="grid grid-cols-3 gap-10 pt-10 text-center">
          <div className="rounded-lg bg-color2 p-8">
            <Link href="/trade/amm" className={linkClass("/trade/amm")}>
              Liquidity Pool
            </Link>
            <p className="leading-loose text-lg">
              Trade tokens instantly using pre-funded pools. Think of it like a
              vending machine - you put in one token and get another out
              immediately. The price changes automatically based on how much of
              each token is available. Perfect for quick trades without waiting
              for someone else to match your order.
            </p>
          </div>
          <div className="rounded-lg bg-color2 p-8">
            <Link href="/trade/amm" className={linkClass("/trade/smart")}>
              Smart Trade
            </Link>
            <p className="leading-loose text-lg">
              Let our system find the best deal for you automatically. It checks
              both trading methods and picks the route that gives you the most
              tokens for your money. Whether it's a direct swap or multiple
              steps, Smart Trade handles the complexity so you get the best
              possible rate with one click.
            </p>
          </div>
          <div className="rounded-lg bg-color2 p-8">
            <Link href="/trade/dex" className={linkClass("/trade/dex")}>
              Order Book
            </Link>
            <p className="leading-loose text-lg">
              Place buy and sell orders like a traditional stock market. You set
              your price and wait for someone to match it. You have full control
              over your trade price, but you need to wait for another user to
              accept your offer. Best for popular tokens and when you want to
              set specific prices.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
