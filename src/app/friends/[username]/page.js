"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import DisplayPendingFriendRequests from "@/components/Friend/DisplayPendingFriendRequests";
import DisplayFriends from "@/components/Friend/DisplayFriends";
import ErrorMdl from "@/components/ErrorMdl";
import TradePanel from "@/components/Smart/TradePanel";
import { CurrentUserWalletProvider } from "@/components/Wallet/CurrentUserWalletProvider";
import { IssuerWalletProvider } from "@/components/Wallet/IssuerWalletProvider";
import { useSession } from "next-auth/react";
import AddFriendBtn from "@/components/Friend/AddFriendBtn";

export default function FriendsPage() {
  const { data: session } = useSession();
  const [username, setUsername] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const params = useParams();
  const userID = params.userID; // Get the userID from the URL

  const [errorMessage, setErrorMessage] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);


  return (
    <CurrentUserWalletProvider>
      <IssuerWalletProvider>
        <div className="min-h-screen bg-color1 p-4" style={{ maxWidth: 'calc(100vw - 16rem - 32rem)' }}>

          {/* Friends Sections */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-full">
            <DisplayFriends />
            <DisplayPendingFriendRequests />
          </div>

          {errorMessage && (
            <ErrorMdl
              errorMessage={errorMessage}
              onClose={() => setErrorMessage("")}
            />
          )}
        </div>

        {/* Trade Panel - Always visible for consistency */}
        {session && <TradePanel />}
      </IssuerWalletProvider>
    </CurrentUserWalletProvider>
  );
}
