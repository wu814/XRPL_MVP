"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import ErrorMdl from "../ErrorMdl";
import RemoveFriendBtn from "./RemoveFriendBtn";
import TransferBtn from "@/components/Wallet/TransferBtn";
import FavoriteBtn from "./FavoriteBtn";
import { useCurrentUserWallet } from "../Wallet/CurrentUserWalletProvider";
import { useIssuerWallet } from "../Wallet/IssuerWalletProvider";

export default function DisplayFriends() {
  const [friends, setFriends] = useState([]);
  const [showErrorMdl, setShowErrorMdl] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // ✅ Pull from WalletContext instead of fetching manually
  const { currentUserWallets } = useCurrentUserWallet();
  const { issuerWallets } = useIssuerWallet();

  // Fetch all accepted friends
  const fetchFriends = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/friends/getAllFriends");
      if (!res.ok) throw new Error("Failed to fetch friends");
      const result = await res.json();
      setFriends(result.data || []);
    } catch (error) {
      setShowErrorMdl(true);
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto rounded-lg bg-color2 p-4">
        <h2 className="mb-4 text-center text-xl font-semibold">Your Friends</h2>
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-mutedText" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto rounded-lg bg-color2 p-2">
      <h2 className="mt-2 mb-4 text-center text-xl font-semibold">Your Friends</h2>

      {friends.length === 0 ? (
        <p className="text-center text-mutedText">You have no friends yet.</p>
      ) : (
        <ul className="space-y-2">
          {friends.map((friend) => (
            <li
              key={friend.id}
              className="flex items-center justify-between rounded-lg bg-color3 p-4"
            >
              <FavoriteBtn friendUsername={friend.username} />
              <div>
                <p className="font-semibold">{friend.username}</p>
                <p className="text-sm text-mutedText">
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
      {showErrorMdl && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setShowErrorMdl(false)}
        />
      )}
    </div>
  );
}
