"use client";

import React, { useState, useEffect } from "react";
import { Star } from "lucide-react";
import ErrorMdl from "../ErrorMdl";

export default function FavoriteBtn({ friendUsername, onFavoriteChange }) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Check if friend is already favorited
  const checkFavoriteStatus = async () => {
    setCheckingStatus(true);
    try {
      const res = await fetch(`/api/friends/checkFavorite?friendUsername=${friendUsername}`);
      const result = await res.json();
      
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
      const endpoint = isFavorited ? "/api/friends/removeFromFavorite" : "/api/friends/addToFavorite";
      const res = await fetch(endpoint, {
        method: isFavorited ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendUsername }),
      });

      const result = await res.json();

      if (!res.ok) throw new Error(result.error || "Failed to update favorite status");

      setIsFavorited(!isFavorited);
      if (onFavoriteChange) onFavoriteChange(!isFavorited);
    } catch (err) {
      setErrorMessage(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="w-6 h-6 flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
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
    </>
  );
} 