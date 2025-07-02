"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

const Searchbar = () => {
  const [searchText, setSearchText] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [fetched, setFetched] = useState(false);

  // Fetch users only once when input is focused
  const handleFocus = async () => {
    if (fetched) return;
    try {
      const res = await fetch("/api/users/getAllUsernames");
      if (!res.ok) throw new Error("Failed to fetch users");
      const result = await res.json();
      console.log("Fetched users:", result.data);
      setAllUsers(result.data);
      setFetched(true);
    } catch (err) {
      console.error(err.message);
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
        <input
          type="text"
          placeholder="Search users..."
          onFocus={handleFocus}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-lg text-xl border border-border bg-color1 focus:border-primary focus:outline-none hover:border-primary"
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

export default Searchbar;
