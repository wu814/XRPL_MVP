"use client";

import { useState } from "react";
import Button from "@/components/Button"; // Adjust the path as needed

export default function AddFriendBtn({ receiverId }) {
  const [status, setStatus] = useState("idle"); // 'idle' | 'sending' | 'sent' | 'error'
  const [error, setError] = useState("");

  const sendRequest = async () => {
    setStatus("sending");
    setError("");

    try {
      const res = await fetch("/api/friends/sendRequest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver_id: receiverId }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to send request");
      }

      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  };

  return (
    <div>
      <Button
        onClick={sendRequest}
        disabled={status === "sending" || status === "sent"}
        variant={status === "sent" ? "cancel" : "primary"}
      >
        {status === "sending"
          ? "Sending..."
          : status === "sent"
          ? "Request Sent"
          : "Send Friend Request"}
      </Button>

      {status === "error" && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
