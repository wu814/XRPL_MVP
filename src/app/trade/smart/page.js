"use client";

import Navbar from "@/components/Navigation/Navbar";
import CreateSmartOffer from "@/components/Offer/CreateSmartOffer";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { CurrentUserWalletProvider } from "@/components/Wallet/CurrentUserWalletProvider";
import { IssuerWalletProvider } from "@/components/Wallet/IssuerWalletProvider";

export default function SmartTrade() {
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
          <div className="container mx-auto flex flex-col">
            <div className="mx-auto max-w-2xl px-4 py-8">
              <div className="rounded-lg bg-color2 p-6">
                <CreateSmartOffer />
              </div>
            </div>
          </div>
        </IssuerWalletProvider>
      </CurrentUserWalletProvider>
    </div>
  );
}
