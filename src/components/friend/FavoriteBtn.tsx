"use client";

import { useState, useEffect } from "react";
import { Star, Loader2 } from "lucide-react";
import ErrorMdl from "../ErrorMdl";

interface FavoriteResponse {
  isFavorited: boolean;
  error?: string;
}

interface FavoriteBtnProps {
  friendUsername: string;
  onFavoriteChange?: (isFavorited: boolean) => void;
}

export default function FavoriteBtn({ friendUsername, onFavoriteChange }: FavoriteBtnProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState<boolean>(false);
  const [checkingStatus, setCheckingStatus] = useState<boolean>(true);

  // Check if friend is already favorited
  const checkFavoriteStatus = async () => {
    setCheckingStatus(true);
    try {
      const res = await fetch(`/api/friend/checkFavorite?friendUsername=${friendUsername}`);
      const result: FavoriteResponse = await res.json();
      
      if (res.ok) {
        setIsFavorited(result.isFavorited);
      }
    } catch (err) {
      console.error("Error checking favorite status:", err);
    } finally {
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    checkFavoriteStatus();
  }, [friendUsername]);

  const handleToggleFavorite = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const endpoint = isFavorited ? "/api/friend/removeFromFavorite" : "/api/friend/addToFavorite";
      const res = await fetch(endpoint, {
        method: isFavorited ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendUsername }),
      });

      const result: FavoriteResponse = await res.json();

      if (!res.ok) throw new Error(result.error || "Failed to update favorite status");

      setIsFavorited(!isFavorited);
      if (onFavoriteChange) onFavoriteChange(!isFavorited);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="w-6 h-6 flex items-center justify-center">
        <Loader2 size={16} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex items-center pr-4">
      <button
        onClick={handleToggleFavorite}
        disabled={loading}
        className={`transition-all duration-200 ${
          loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-110'
        }`}
        title={isFavorited ? "Remove from favorites" : "Add to favorites"}
      >
        <Star
          size={20}
          className={`transition-colors duration-200 ${
            isFavorited 
              ? 'fill-yellow-400 text-yellow-400' 
              : 'text-gray-400 hover:text-yellow-400'
          }`}
        />
      </button>

      {errorMessage && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}
    </div>
  );
};
