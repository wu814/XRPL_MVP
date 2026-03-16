"use client";

import { useState } from "react";
import Button from "../app/Button";
import ErrorMdl from "../app/ErrorMdl";
import { APIResponse } from "@/types/apiTypes";
import SuccessMdl from "../app/SuccessMdl";

interface RemoveFriendBtnProps {
  friendId: string | number;
  onRemoved?: (message: string) => void;
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

      if (!res.ok) {
        const errorData: APIResponse<never> = await res.json();
        setErrorMessage(errorData.message);
        return;
      }
      const result: APIResponse<never> = await res.json();
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }

      if (onRemoved) onRemoved(result.message);
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
