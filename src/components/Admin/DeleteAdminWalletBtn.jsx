"use client";

import React, { useState, useEffect } from "react";
import Button from "../Button";
import ErrorModal from "../ErrorModal";
import SuccessModal from "../SuccessModal";

export default function DeleteAdminWalletBtn({ classic_address, onWalletDeleted }) {
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [adminPassword, setAdminPassword] = useState("");

    // The actual delete handler
    const handleDelete = async () => {
        setLoading(true);

        try {
            const res = await fetch("/api/wallets/deleteWallet", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ classic_address, adminPassword }),
            });

            const result = await res.json();
            if (!res.ok) {
                throw new Error(result.error || "Failed to delete wallet");
            }
            setSuccessMessage("Wallet deleted successfully!");
        } catch (err) {
            setErrorMessage(err.message);
        } finally {
            setLoading(false);
            setAdminPassword("");
            //setShowConfirm(false); 
        }
    };
    useEffect(() => {
        if (successMessage) {
            console.log("Success modal message updated:", successMessage);
        }
    }, [successMessage]);
    

    return (
        <div>
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

            {errorMessage && (
                <ErrorModal
                    errorMessage={errorlMessage}
                    onClose={() => setErrorMessage(null)}
                />
            )}

            {successMessage && (
                <SuccessModal
                    successMessage={successMessage}
                    onClose={() => {
                        setSuccessMessage(null);
                        onWalletDeleted(classic_address);
                    }}
                />
            )}

            {/* ConfirmationrModal */}
            {showConfirm && (
                <div className="fixed inset-0 z-25 flex items-center justify-center bg-stone-950/50">
                    <div className="bg-white p-6 rounded-lg shadow-lg w-96">
                        <h2 className="text-xl font-bold mb-4 text-center">
                            Confirm Deletion
                        </h2>
                        <p className="mb-4 text-center">
                            Please enter the admin password to confirm deletion.
                        </p>
                        <input
                            type="password"
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            className="w-full border border-gray-300 rounded p-2 mb-4"
                            placeholder="Admin Password"
                        />
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
