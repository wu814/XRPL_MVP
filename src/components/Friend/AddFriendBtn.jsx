"use client";

import { useState } from "react";
import Button from "@/components/Button";
import SuccessMdl from "../SuccessMdl";
import ErrorMdl from "../ErrorMdl";

export default function AddFriendBtn({ receiver }) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const sendRequest = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/friends/sendRequest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to send request");
      }
      setSuccessMessage(result.message);
    } catch (err) {
      setErrorMessage(err.message);
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
          onClose={() => setErrorMessage(null)}
        />
      )}

      {successMessage && (
        <SuccessMdl
          successMessage={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}
    </div>
  );
}
