"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { use } from "react";
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
  const [userWalletAddress, setUserWalletAddress] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchUserWalletAddress = async (username) => {
    try {
      const res = await fetch("/api/wallets/getWalletAddressByUsername", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to fetch user data");
      }
      setUserWalletAddress(result.data.classic_address);
    } catch (error) {
      setErrorMessage(error.message || "Failed to fetch wallet address");
      return null;
    }
  };

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
    fetchUserWalletAddress(username);
    fetchIssuerWallets();
    fetchWallets();
  }, [username]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold">User Profile: {username}</h1>

      {/* Show transfer button if user wallet address is available 
        assume that it is user's wallet so there is only one wallet wallets[0]
      */}
      {userWalletAddress &&
        <TransferBtn senderWallet={wallets[0]} issuerWallets={issuerWallets} presetRecipientAddress={userWalletAddress} />
      }
      {/* You can add more user-specific content here */}

      {errorMessage && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}
    </div>
  );
}
