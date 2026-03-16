"use client";

import { useState } from "react";
import Button from "@/components/app/Button";
import SuccessMdl from "../app/SuccessMdl";
import ErrorMdl from "../app/ErrorMdl";
import { APIResponse } from "@/types/apiTypes";

interface AddFriendBtnProps {
  receiver: string;
}

export default function AddFriendBtn({ receiver }: AddFriendBtnProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  const sendRequest = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/friend/sendFriendRequest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver }),
      });

      if (!res.ok) {
        const errorData: APIResponse<never> = await res.json();
        setErrorMessage(errorData.message);
        return;
      }

      const result: APIResponse<never> = await res.json();
      setSuccessMessage(result.message || "Friend request sent successfully");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button onClick={sendRequest} disabled={loading}>
        {loading ? "Sending Request..." : "Add Friend"}
      </Button>

      {errorMessage && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setErrorMessage("")}
        />
      )}

      {successMessage && (
        <SuccessMdl
          successMessage={successMessage}
          onClose={() => setSuccessMessage("")}
        />
      )}
    </div>
  );
};
