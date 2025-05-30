"use client";

import { useEffect, useState } from "react";
import ErrorMdl from "../ErrorMdl";

export default function DisplayFriends() {
  const [friends, setFriends] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);

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
            <li key={friend.id} className="rounded-md bg-color3 p-4 shadow">
              <p>Username: {friend.username}</p>
              <p>
                Friends since: {new Date(friend.responded_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
