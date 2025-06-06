"use client";

import { useEffect, useState } from "react";
import ErrorMdl from "../ErrorMdl";
import RemoveFriendBtn from "./RemoveFriendBtn";
import TransferBtn from "@/components/Wallet/TransferBtn";
import { useCurrentUserWallet } from "../Wallet/CurrentUserWalletProvider";
import { useIssuerWallet } from "../Wallet/IssuerWalletProvider";

export default function DisplayFriends() {
  const [friends, setFriends] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);

  // ✅ Pull from WalletContext instead of fetching manually
  const { currentUserWallets } = useCurrentUserWallet();
  const { issuerWallets } = useIssuerWallet();
  

  // Fetch all accepted friends
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
  }, []);

  return (
    <div className="container mx-auto rounded-lg bg-color2 p-4">
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
            <li
              key={friend.id}
              className="flex items-center justify-between rounded-lg bg-color3 p-4"
            >
              <div>
                <p>Username: {friend.username}</p>
                <p>
                  Friends since:{" "}
                  {new Date(friend.responded_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex space-x-2">
                {/* Use primary wallet to send XRP or tokens */}
                <TransferBtn
                  senderWallet={currentUserWallets[0]} // ✅ assumes first wallet is primary
                  issuerWallets={issuerWallets}
                  presetRecipientUsername={friend.username}
                />
                <RemoveFriendBtn
                  friendId={friend.id}
                  onRemoved={fetchFriends}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
