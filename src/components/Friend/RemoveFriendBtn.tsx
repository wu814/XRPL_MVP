"use client";

import { useState } from "react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";

interface RemoveFriendResponse {
  error?: string;
}

interface RemoveFriendBtnProps {
  friendId: string | number;
  onRemoved?: () => void;
}

export default function RemoveFriendBtn({ friendId, onRemoved }: RemoveFriendBtnProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRemove = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/friend/deleteFriend", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: friendId }),
      });

      const result: RemoveFriendResponse = await res.json();

      if (!res.ok) throw new Error(result.error || "Failed to remove friend");

      if (onRemoved) onRemoved();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="cancel" onClick={handleRemove} disabled={loading}>
        {loading ? "Removing..." : "Remove"}
      </Button>

      {errorMessage && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}
    </>
  );
};
