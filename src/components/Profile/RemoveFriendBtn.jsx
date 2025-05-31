"use client";

import React, { useState } from "react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";

export default function RemoveFriendBtn({ friendId, onRemoved }) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleRemove = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/friends/deleteFriend", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: friendId }),
      });

      const result = await res.json();

      if (!res.ok) throw new Error(result.error || "Failed to remove friend");

      if (onRemoved) onRemoved();
    } catch (err) {
      setErrorMessage(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="cancel"
        onClick={handleRemove}
        disabled={loading}
      >
        {loading ? "Removing..." : "Remove Friend"}
      </Button>

      {errorMessage && (
        <ErrorMdl errorMessage={errorMessage} onClose={() => setErrorMessage(null)} />
      )}
    </>
  );
}
