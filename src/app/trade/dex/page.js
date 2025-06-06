"use client";

import Navbar from "@/components/Navigation/Navbar";
import CreateOffer from "@/components/Offer/CreateOffer";
import DisplayAllOffers from "@/components/Offer/DisplayAllOffers";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { CurrentUserWalletProvider } from "@/components/Wallet/CurrentUserWalletProvider";
import { IssuerWalletProvider } from "@/components/Wallet/IssuerWalletProvider";

export default function DEX() {
  const { data: session, status } = useSession();
  const [username, setUsername] = useState("");

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
          <div className="px-4">
            <div className="grid grid-cols-3 gap-4 p-4">
              <div className="col-span-1 space-y-6 rounded-lg bg-color2 p-4">
                <CreateOffer />
              </div>
              <div className="col-span-1 rounded-lg bg-color2 p-4">
                <DisplayAllOffers />
              </div>
              <div className="col-span-1 rounded-lg bg-color2 p-4">
                <h2 className="text-lg font-bold mb-4">Trade History</h2>
                <p className="text-mutedText">Trade history will be displayed here.</p>   
              </div>
            </div>
          </div>
        </IssuerWalletProvider>
      </CurrentUserWalletProvider>
    </div>
  );
}
