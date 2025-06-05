"use client";

import Navbar from "@/components/Navigation/Navbar";
import CreateOffer from "@/components/Offer/CreateOffer";
import { useWallet } from "@/components/WalletContext";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export default function DEX() {
  const { data: session, status } = useSession();
  const { currentUserWallets, issuerWallets } = useWallet();
  const [username, setUsername] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      setUsername(session.user.username || "");
    }
  }, [session, status]);

  const offerCreatorWallet = currentUserWallets?.find(
    (wallet) =>
      wallet.walletType === "USER" || wallet.walletType === "STANDBY PATHFIND",
  );

  return (
    <div>
      <Navbar username={username} />
      <div className="container mx-auto">
        <div className="grid grid-cols-5 gap-4 p-4">
          <div className="col-span-2 space-y-6 rounded-xl bg-color2 p-4">
            <h1 className="text-2xl font-bold text-white">Create an Offer</h1>
            <CreateOffer
              issuerWallets={issuerWallets}
              offerCreatorWallet={offerCreatorWallet}
            />
          </div>
          <div className="col-span-3 rounded-xl bg-color2 p-4">
            <h1>Offer List</h1>
          </div>
        </div>
      </div>
    </div>
  );
}
