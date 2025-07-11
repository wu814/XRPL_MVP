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
import usePageTitle from "@/utils/usePageTitle";

export default function FriendsPage() {
  const { data: session } = useSession();
  const [username, setUsername] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const params = useParams();
  const userID = params.userID; // Get the userID from the URL

  const [errorMessage, setErrorMessage] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Set page title
  usePageTitle("Friends - YONA");

  return (
    <CurrentUserWalletProvider>
      <IssuerWalletProvider>
        <div className="p-2 min-h-screen bg-color1">
          {/* Friends Sections */}
          <div className="grid max-w-full grid-cols-1 gap-2 xl:grid-cols-2">
            <DisplayFriends />
            <DisplayPendingFriendRequests />
          </div>

          {errorMessage && (
            <ErrorMdl
              errorMessage={errorMessage}
              onClose={() => setErrorMessage("")}
            />
          )}
          {session && <TradePanel />}
        </div>
      </IssuerWalletProvider>
    </CurrentUserWalletProvider>
  );
}
