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

export default function ProfilePage() {
  const { data: session } = useSession();
  const [username, setUsername] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const params = useParams();
  const userID = params.userID; // Get the userID from the URL

  const [errorMessage, setErrorMessage] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch("/api/users/getAllUsernames");
      if (!res.ok) throw new Error("Failed to search users");
      const result = await res.json();
      
      // Filter usernames based on search query
      const filteredUsers = result.data.filter(user => 
        user.username.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(filteredUsers);
    } catch (error) {
      setErrorMessage(error.message || "Failed to search users");
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  return (
    <CurrentUserWalletProvider>
      <IssuerWalletProvider>
        <div className="min-h-screen bg-color1 p-8 " style={{ maxWidth: 'calc(100vw - 16rem - 32rem)' }}>
          {/* Search Bar */}
          <div className="mb-8">
            <div className="max-w-lg mx-auto">
              <div className="relative">
                <Search className="w-6 h-6 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search for friends by username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-color2 border border-gray-600 rounded-lg pl-12 pr-4 py-4 text-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              
              {/* Search Results */}
              {searchQuery && (
                <div className="mt-4 bg-color2 border border-gray-600 rounded-lg max-h-60 overflow-y-auto">
                  {isSearching ? (
                    <div className="p-4 text-center text-gray-400">Searching...</div>
                  ) : searchResults.length > 0 ? (
                    <div className="divide-y divide-gray-600">
                      {searchResults.map((user, index) => (
                        <div key={index} className="flex items-center justify-between p-4 hover:bg-color3 transition-colors">
                          <Link
                            href={`/user/${user.username}`}
                            className="flex-1 cursor-pointer"
                            onClick={() => setSearchQuery("")}
                          >
                            <div className="font-medium text-lg">{user.username}</div>
                          </Link>
                          <AddFriendBtn receiver={user.username} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-gray-400">No users found</div>
                  )}
                </div>
              )}
            </div>
          </div>

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
