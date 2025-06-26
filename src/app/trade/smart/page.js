"use client";

import SmartTradeMenu from "@/components/Smart/SmartTradeMenu";
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
    <div className="p-8">
      <h1 className="text-4xl font-bold mb-8 text-center">Smart Trade</h1>
      <CurrentUserWalletProvider>
        <IssuerWalletProvider>
          <div className="container mx-auto flex flex-col">
            <div className="mx-auto max-w-2xl px-4 py-8">
              <div className="rounded-lg bg-color2 p-6">
                <SmartTradeMenu />
              </div>
            </div>
          </div>
        </IssuerWalletProvider>
      </CurrentUserWalletProvider>
    </div>
  );
}
