"use client";

import React, { useState } from "react";
import Button from "./Button";
import { useSession } from "next-auth/react";

export default function UpdateUsernameMdl({ onClose, onUpdated }) {
  const { data: session } = useSession();
  const [username, setUsername] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setError(null);
    if (!username.trim() || /\s/.test(username)) {
      setError("Username cannot be empty or contain spaces.");
      return;
    }
    if (username === session?.user?.email) {
      setError("Username cannot be the same as your email.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/users/updateUserName", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update");
      onUpdated(username.trim());
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50">
      <div className="w-80 rounded-lg bg-modal p-6 shadow-lg">
        <h2 className="mb-4 text-center text-xl font-bold">
          Choose a Username
        </h2>

        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="no spaces allowed"
          className="mb-2 w-full rounded border border-border bg-modal p-2 focus:border-primary focus:outline-none"
        />

        {error && <p className="mb-2 text-sm text-red-500">{error}</p>}

        <div className="flex justify-end space-x-2">
          <Button variant="cancel" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
