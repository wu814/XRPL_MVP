"use client";

import React, { useState } from "react";
import Button from "../Button";
import CreateUserWalletModal from "./CreateUserWalletModal";


export default function CreateAdminWalletBtn({ onWalletCreated }) {
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    const handleWalletCreated = async (currency) => {
        setLoading(true);
        setErrorMessage(null);

        try {
            
            const res = await fetch("/api/tags/createTag", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currency }),
            });
            const result = await res.json();
            const walletData = result.data[0];
            if (!res.ok) throw new Error(result.error || "Failed to add wallet");

            if (onWalletCreated) onWalletCreated(walletData);

            setSuccessMessage(`Wallet created successfully!`);
        } catch (err) {
            setErrorMessage(err.message);
        }
        finally {
            setLoading(false);
        }
        
    };

    const handleErrorClose = () => {
        setErrorMessage(null);
    }
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
                <CreateUserWalletModal
                    onClose={() => setShowModal(false)}
                    onSubmit={handleWalletCreated}
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
