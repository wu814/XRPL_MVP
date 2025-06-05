"use client";

import { useEffect, useState } from "react";
import Button from "@/components/Button";
import ErrorMdl from "@/components/ErrorMdl";

export default function DisplayPendingFriendRequests() {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showErrorMdl, setShowErrorMdl] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchPendingFriendRequests = async () => {
    try {
      const res = await fetch("/api/friends/getPendingFriendRequests");
      if (!res.ok) throw new Error("Failed to fetch pending requests");
      const result = await res.json();
      setPendingRequests(result.data);
    } catch (error) {
      setShowErrorMdl(true);
      setErrorMessage(error.message);
    }
  };

  const handleResponse = async (request_id, action) => {
    try {
      const res = await fetch("/api/friends/respondRequest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id, action }),
      });

      const result = await res.json();
      if (!res.ok)
        throw new Error(result.error || "Failed to respond to request");

      setPendingRequests((prev) => prev.filter((req) => req.id !== request_id));
    } catch (err) {
      setErrorMessage(err.message);
      setShowErrorMdl(true);
    }
  };

  useEffect(() => {
    fetchPendingFriendRequests();
  }, []);

  return (
    <div className="container mx-auto rounded-lg bg-color2 p-4">
      <h2 className="mb-4 text-center text-xl font-semibold">
        Pending Friend Requests
      </h2>
      {pendingRequests.length === 0 ? (
        <p className="text-center text-mutedText">No pending requests.</p>
      ) : (
        <ul className="space-y-4 px-2">
          {pendingRequests.map((req) => (
            <li
              key={req.id}
              className="flex items-center justify-between rounded-lg bg-color3 p-4"
            >
              <div>
                <p className="font-medium">From: {req.sender || "Unknown"}</p>
                <p>Sent on: {new Date(req.sent_at).toLocaleDateString()}</p>
              </div>
              <div className="space-x-2">
                <Button
                  variant="primary"
                  onClick={() => handleResponse(req.id, "accept")}
                >
                  Accept
                </Button>
                <Button
                  variant="cancel"
                  onClick={() => handleResponse(req.id, "reject")}
                >
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {showErrorMdl && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setShowErrorMdl(false)}
        />
      )}
    </div>
  );
}
