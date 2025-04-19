"use client";

import React, { useState } from "react";
import Button from "./Button";
import { useSession } from "next-auth/react";

export default function UpdateUsernameModal({ onClose, onUpdated }) {
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-80">
                <h2 className="text-xl font-bold mb-4 text-center">
                    Choose a Username 
                </h2>
                
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="no spaces allowed"
                    className="w-full border border-gray-300 rounded p-2 mb-2"
                />

                {error && (
                    <p className="text-red-500 text-sm mb-2">{error}</p>
                )}

                <div className="flex justify-end space-x-2">
                    <Button variant="cancel" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button
                        variant="submit"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? "Saving…" : "Save"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
