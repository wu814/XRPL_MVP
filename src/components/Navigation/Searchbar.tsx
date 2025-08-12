"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Loader2 } from "lucide-react";

interface User {
  username: string;
}

interface ApiResponse {
  data: User[];
}

export default function Searchbar() {
  const [searchText, setSearchText] = useState<string>("");
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [fetched, setFetched] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Fetch users only once when input is focused
  const handleFocus = async () => {
    if (fetched) return;
    setLoading(true);
    try {
      const res = await fetch("/api/user/getAllUsernames");
      if (!res.ok) throw new Error("Failed to fetch users");
      const result: ApiResponse = await res.json();
      setAllUsers(result.data);
      setFetched(true);
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Filter as user types
  useEffect(() => {
    if (searchText === "") {
      setFilteredUsers([]);
      return;
    }
    const filtered = allUsers.filter((user) =>
      user.username.toLowerCase().includes(searchText.toLowerCase()),
    );
    setFilteredUsers(filtered);
  }, [searchText, allUsers]);

  return (
    <div className="relative mx-4 flex-1">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="w-6 h-6 text-gray-400" />
        </div>
        {loading && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        )}
        <input
          type="text"
          placeholder="Search users..."
          onFocus={handleFocus}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className={`w-full pl-12 py-3 rounded-lg text-xl border border-border bg-color1 focus:border-primary focus:outline-none hover:border-primary ${
            loading ? "pr-12" : "pr-4"
          }`}
        />
      </div>
      {filteredUsers.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-lg bg-color4 border border-border shadow-lg">
          {filteredUsers.map((user) => (
            <li key={user.username}>
              <Link
                href={`/user/${user.username}`}
                className="block px-4 py-2 text-lg hover:bg-color5 first:rounded-t-lg last:rounded-b-lg"
                onClick={() => setSearchText("")}
              >
                {user.username}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};