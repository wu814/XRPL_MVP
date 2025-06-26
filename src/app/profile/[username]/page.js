"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Search } from "lucide-react";
import DisplayPendingFriendRequests from "@/components/Friend/DisplayPendingFriendRequests";
import DisplayFriends from "@/components/Friend/DisplayFriends";
import ErrorMdl from "@/components/ErrorMdl";
import TradePanel from "@/components/TradePanel";
import { CurrentUserWalletProvider } from "@/components/Wallet/CurrentUserWalletProvider";
import { IssuerWalletProvider } from "@/components/Wallet/IssuerWalletProvider";
import { useSession } from "next-auth/react";

export default function ProfilePage() {
  const { data: session } = useSession();
  const [username, setUsername] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const params = useParams();
  const userID = params.userID; // Get the userID from the URL

  const [userData, setUserData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const fetchUserData = async () => {
    try {
      const res = await fetch("/api/users/getUserByUserID");
      if (!res.ok) throw new Error("Failed to fetch user data");
      const result = await res.json();
      setUserData(result.data);
    } catch (error) {
      setErrorMessage(error.message || "Failed to fetch user data");
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [userID]);

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
        <div className="min-h-screen bg-color1 p-8 ml-64" style={{ maxWidth: 'calc(100vw - 16rem - 32rem)' }}>
          {/* Page Header */}
          <div className="mb-8">
            {userData ? (
              <div className="text-center">
                <h1 className="mb-4 text-4xl font-bold">Profile: {userData.username}</h1>
                <p className="text-xl text-gray-400">Email Address: {userData.email_address}</p>
                <p className="text-xl text-gray-400">Joined at: {new Date(userData.created_at).toLocaleDateString()}</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-xl">Loading user data...</p>
              </div>
            )}
          </div>

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
                        <div key={index} className="p-4 hover:bg-color3 cursor-pointer transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-lg">{user.username}</div>
                              <div className="text-sm text-gray-400">User</div>
                            </div>
                            <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                              Add Friend
                            </button>
                          </div>
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
        {session && <TradePanel user={session.user} session={session} />}
      </IssuerWalletProvider>
    </CurrentUserWalletProvider>
  );
}
