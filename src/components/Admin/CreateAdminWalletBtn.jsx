"use client";

import React, { useState } from "react";
import Button from "../Button";
import CreateAdminWalletModal from "./CreateAdminWalletModal";
import { createWallet } from "@/utils/xrpl/createWallet";

export default function CreateAdminWalletBtn({ onWalletCreated }) {
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // 1) handles creation + persistence
    const handleCreateWallet = async (walletType, walletName) => {
        setLoading(true);
        setErrorMessage(null);

        try {
            const walletData = await createWallet(walletType, walletName);

            const res = await fetch("/api/wallets/createWallet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(walletData),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Failed to add wallet");

            if (onWalletCreated) onWalletCreated(walletData);

            setSuccessMessage(`${walletType} wallet created successfully!`);
        } catch (err) {
            setErrorMessage(err.message);
        } finally {
            setLoading(false);
        }
    };

    // 2) user closes the error modal
    const handleErrorClose = () => {
        setErrorMessage(null);
    };

    // 3) user closes the success modal (and the dialog)
    const handleSuccessClose = () => {
        setSuccessMessage(null);
        setShowModal(false);
    };

    return (
        <div>
            <Button
                variant="submit"
                onClick={() => setShowModal(true)}
                className="w-full mt-4 hover:scale-none"
            >
                + Create Wallet
            </Button>

            {showModal && (
                <CreateAdminWalletModal
                    onClose={() => setShowModal(false)}
                    onSubmit={handleCreateWallet}
                    loading={loading}
                    errorMessage={errorMessage}
                    onErrorClose={handleErrorClose}
                    successMessage={successMessage}
                    onSuccessClose={handleSuccessClose}
                />
            )}
        </div>
    );
}
