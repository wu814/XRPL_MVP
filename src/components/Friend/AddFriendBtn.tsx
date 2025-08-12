"use client";

import { useState } from "react";
import Button from "@/components/Button";
import SuccessMdl from "../SuccessMdl";
import ErrorMdl from "../ErrorMdl";

interface AddFriendResponse {
  message?: string;
  error?: string;
}

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
      const res = await fetch("/api/friend/sendRequest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver }),
      });

      const result: AddFriendResponse = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to send request");
      }
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
