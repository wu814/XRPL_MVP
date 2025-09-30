"use client";

import { useState, useEffect } from "react";
import { Star, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { APIResponse } from "@/types/apiTypes";
import { Favorite } from "@/types/appTypes";

interface FavoritesListProps {
  onRecipientClick: (username: string) => void;
}

export default function FavoritesList({ onRecipientClick }: FavoritesListProps) {
  const { data: sessionData } = useSession();
  const [favorites, setFavorites] = useState<Favorite[] >([]);
  const [loadingFavorites, setLoadingFavorites] = useState<boolean>(false);
  const [showAll, setShowAll] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch favorites function
  const fetchFavorites = async () => {
    setLoadingFavorites(true);
    try {
      const res = await fetch("/api/friend/getAllFavorites");
      if (!res.ok) {
        const errorData: APIResponse = await res.json();
        setErrorMessage(errorData.message);
        return;
      }
      const result: APIResponse<Favorite[]> = await res.json();
      setFavorites(result.data || []);
    } catch (err) {
      console.error("Error fetching favorites:", err);
      setFavorites([]);
      setErrorMessage("Error fetching favorites");
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
  if (favorites.length === 0 && !loadingFavorites && !errorMessage) {
    return null;
  }

  // Determine which favorites to display
  const displayedFavorites = showAll ? favorites : favorites.slice(0, 3);

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-medium">Favorites</h3>
        {favorites.length > 3 && (
          <button 
            className="text-sm text-blue-400 hover:text-blue-300"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Show less' : 'See all'}
          </button>
        )}
      </div>

      {loadingFavorites ? (
        <div className="py-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
          <p className="mt-2 text-gray-400">Loading favorites...</p>
        </div>
      ) : (
        displayedFavorites.map((fav) => (
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
      {errorMessage && (
        <div className="mt-4 text-sm text-red-500">
          {errorMessage}
        </div>
      )}
    </div>
  );
};
