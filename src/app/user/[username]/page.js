"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { use } from "react";
import Navbar from "@/components/Navbar";
import TransferBtn from "@/components/Wallet/TransferBtn";
import ErrorMdl from "@/components/ErrorMdl";

class Wallet {
  constructor(classicAddress, walletType, seed) {
    this.classicAddress = classicAddress;
    this.walletType = walletType;
    this.seed = seed;
  }
}

export default function UserPage() {
  const params = useParams();
  const username = params.username; // Get the username from the URL
  const [issuerWallets, setIssuerWallets] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchIssuerWallets = async () => {
    try {
      const res = await fetch("/api/wallets/getIssuerWallets");
      const result = await res.json();
      if (Array.isArray(result.data) && result.data.length > 0) {
        const issuerWalletsData = result.data.map(
          (wallet) =>
            new Wallet(wallet.classic_address, wallet.wallet_type, wallet.seed),
        );
        setIssuerWallets(issuerWalletsData);
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to fetch issuer wallets");
    }
  };

  const fetchWallets = async () => {
    try {
      const res = await fetch("/api/wallets/getWalletsByUserID");
      const result = await res.json();
      if (Array.isArray(result.data) && result.data.length > 0) {
        const walletsData = result.data.map(
          (wallet) =>
            new Wallet(wallet.classic_address, wallet.wallet_type, wallet.seed),
        );
        setWallets(walletsData);
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to fetch user wallets");
    }
  };

  useEffect(() => {
    fetchIssuerWallets();
    fetchWallets();
  }, [username]);

  return (
    <div>
      <Navbar />
      <div className="flex flex-col items-center">
        <h1 className="text-2xl font-bold">User Profile: {username}</h1>

        {/* Show transfer button if user wallet address is available 
        assume that it is user's wallet so there is only one wallet wallets[0]
      */}
        {username && (
          <TransferBtn
            senderWallet={wallets[0]}
            issuerWallets={issuerWallets}
            presetRecipientUsername={username}
          />
        )}
        {/* You can add more user-specific content here */}

        {errorMessage && (
          <ErrorMdl
            errorMessage={errorMessage}
            onClose={() => setErrorMessage(null)}
          />
        )}
      </div>
    </div>
  );
}
