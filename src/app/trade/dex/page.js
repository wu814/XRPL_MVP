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
          <div className="container mx-auto">
            <div className="grid grid-cols-5 gap-4 p-4">
              <div className="col-span-2 space-y-6 rounded-lg bg-color2 p-4">
                <CreateOffer />
              </div>
              <div className="col-span-3 rounded-lg bg-color2 p-4">
                <DisplayAllOffers />
              </div>
            </div>
          </div>
        </IssuerWalletProvider>
      </CurrentUserWalletProvider>
    </div>
  );
}
