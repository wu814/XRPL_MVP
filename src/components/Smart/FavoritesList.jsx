"use client";

import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { useSession } from "next-auth/react";

export default function FavoritesList({ onRecipientClick }) {
  const { data: sessionData } = useSession();
  const [favorites, setFavorites] = useState([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);

  // Fetch favorites function
  const fetchFavorites = async () => {
    setLoadingFavorites(true);
    try {
      const res = await fetch("/api/favorites/getAllFavorites");
      if (!res.ok) throw new Error("Failed to fetch favorites");
      const result = await res.json();
      console.log(result.data);
      setFavorites(result.data || []);
    } catch (err) {
      console.error("Error fetching favorites:", err);
      setFavorites([]);
    } finally {
      setLoadingFavorites(false);
    }
  };

  // Fetch favorites when component mounts
  useEffect(() => {
    if (sessionData?.user?.username) {
      fetchFavorites();
    }
  }, [sessionData?.user?.username]);

  // Don't render if no favorites
  if (favorites.length === 0 && !loadingFavorites) {
    return null;
  }

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-medium">Favorites</h3>
        <button className="text-sm text-blue-400">See all</button>
      </div>

      {loadingFavorites ? (
        <div className="py-4 text-center">
          <div className="mx-auto h-5 w-5 animate-spin rounded-full border-b-2 border-blue-500"></div>
          <p className="mt-2 text-gray-400">Loading favorites...</p>
        </div>
      ) : (
        favorites.map((fav) => (
          <div
            key={fav.id}
            className="flex cursor-pointer items-center space-x-4 rounded-lg p-3 hover:bg-color3"
            onClick={() => onRecipientClick(fav.friend_username)}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-600">
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            </div>
            <div className="font-medium">{fav.friend_username}</div>
          </div>
        ))
      )}
    </div>
  );
}
