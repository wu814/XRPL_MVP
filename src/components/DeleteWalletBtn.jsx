"use client";

import React, { useState } from "react";
import Button from "./Button";
import ErrorPopup from "./ErrorPopup";

export default function DeleteWalletBtn({ classic_address, onWalletDeleted }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);

    // The actual delete handler
    const handleDelete = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/wallets/deleteWallet", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ classic_address }),
            });

            const result = await res.json();
            if (!res.ok) {
                throw new Error(result.error || "Failed to delete wallet");
            }
            // Notify the parent that the wallet is deleted.
            if (onWalletDeleted) {
                onWalletDeleted(classic_address);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            setShowConfirm(false); // Close the confirmation popup
        }
    };

    return (
        <div>
            {/* Delete Button (trash icon) */}
            <button
                onClick={() => setShowConfirm(true)}
                disabled={loading}
                className="absolute top-2 right-3 transition duration-300 ease-in-out hover:scale-110"
            >
                <svg
                    className="w-7 h-7 text-red-600"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    width="24" height="24"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 7h14m-9 3v8m4-8v8M10 3h4a1 1 0 0 1 1 1v3H9V4a1 1 0 0 1 1-1ZM6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Z" />
                </svg>
            </button>

            {error && <ErrorPopup errorMessage={error} onClose={() => setError(null)} />}

            {/* Confirmation Popup */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50">
                    <div className="bg-white p-6 rounded-lg shadow-lg w-96">
                        <h2 className="text-xl font-bold mb-4 text-center">
                            Confirm Deletion
                        </h2>
                        <p className="mb-6">
                            Are you sure you want to remove this wallet from dashboard?
                            <br />
                            <span className="font-bold">Classic Address: {classic_address}</span>
                        </p>
                        <div className="flex justify-end space-x-2">
                            <Button
                                variant="cancel"
                                onClick={() => setShowConfirm(false)}
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="submit"
                                onClick={handleDelete}
                                disabled={loading}
                            >
                                {loading ? "Deleting..." : "Delete"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
