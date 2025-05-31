"use client";

import { useEffect, useState } from "react";
import ErrorMdl from "../ErrorMdl";
import RemoveFriendBtn from "./RemoveFriendBtn";
import TransferBtn from "@/components/Wallet/TransferBtn";

class Wallet {
  constructor(classicAddress, walletType, seed) {
    this.classicAddress = classicAddress;
    this.walletType = walletType;
    this.seed = seed;
  }
}


export default function DisplayFriends() {
  const [friends, setFriends] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);
  const [issuerWallets, setIssuerWallets] = useState([]);
  const [wallets, setWallets] = useState([]);

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

  const fetchFriends = async () => {
    try {
      const res = await fetch("/api/friends/getAllFriends");
      if (!res.ok) throw new Error("Failed to fetch friends");
      const result = await res.json();
      setFriends(result.data || []);
    } catch (err) {
      setErrorMessage(err.message || "Unknown error");
    }
  };

  useEffect(() => {
    fetchFriends();
    fetchIssuerWallets();
    fetchWallets();
  }, []);

  return (
    <div className="container mx-auto rounded-xl p-4 bg-color2">
      <h2 className="mb-4 text-center text-xl font-semibold">Your Friends</h2>

      {errorMessage && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}

      {friends.length === 0 ? (
        <p className="text-center text-mutedText">You have no friends yet.</p>
      ) : (
        <ul className="space-y-4 px-2">
          {friends.map((friend) => (
            <li key={friend.id} className="rounded-md bg-color3 p-4 shadow flex justify-between items-center">
              <div>
                <p>Username: {friend.username}</p>
                <p>
                  Friends since: {new Date(friend.responded_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex space-x-2">
                <TransferBtn senderWallet={wallets[0]} issuerWallets={issuerWallets} presetRecipientUsername={friend.username} />
                <RemoveFriendBtn friendId={friend.id} onRemoved={fetchFriends} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
