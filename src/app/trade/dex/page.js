"use client";

import Navbar from "@/components/Navigation/Navbar";
import CreateOffer from "@/components/Offer/CreateOffer";
import DisplayAllOffers from "@/components/Offer/DisplayAllOffers";
import DisplayUserOffers from "@/components/Offer/DisplayUserOffers";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { CurrentUserWalletProvider } from "@/components/Wallet/CurrentUserWalletProvider";
import { IssuerWalletProvider } from "@/components/Wallet/IssuerWalletProvider";
import CurrencyPairSelection from "@/components/Currency/CurrencyPairSelection";

export default function DEX() {
  const { data: session, status } = useSession();
  const [username, setUsername] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [quoteCurrency, setQuoteCurrency] = useState("XRP");

  useEffect(() => {
    if (status === "authenticated") {
      setUsername(session.user.username || "");
    }
  }, [session, status]);

  return (
    <div>
      <Navbar username={username} />
      <CurrentUserWalletProvider>
        <IssuerWalletProvider>
          <div className="mx-auto flex flex-col px-4 space-y-4">
            <CurrencyPairSelection
              onPairUpdate={(base, quote) => {
                setBaseCurrency(base);
                setQuoteCurrency(quote);
              }}
            />
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-2 rounded-lg bg-color2 p-4">
                <h1 className="text-2xl font-bold">Price Chart</h1>
              </div>
              <div className="col-span-1 rounded-lg bg-color2 p-4">
                <DisplayAllOffers
                  baseCurrency={baseCurrency}
                  quoteCurrency={quoteCurrency}
                />
              </div>
              <div className="col-span-1 space-y-6 rounded-lg bg-color2 p-4">
                <CreateOffer 
                  baseCurrency={baseCurrency}
                  quoteCurrency={quoteCurrency}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-color2 p-4">
                <h1 className="p-4 text-center text-2xl font-semibold">
                  History
                </h1>
              </div>
              <div className="col-span-1 rounded-lg bg-color2 p-4">
                <DisplayUserOffers />
              </div>
            </div>
          </div>
        </IssuerWalletProvider>
      </CurrentUserWalletProvider>
    </div>
  );
}
