"use client";

import React, { useState, useEffect } from "react";
import Button from "../Button";
import ErrorModal from "../ErrorModal";
import SuccessModal from "../SuccessModal";

export default function CreateAdminWalletModal({
    onClose,
    onSubmit,
    loading,
    errorMessage,
    onErrorClose,
    successMessage,
    onSuccessClose,
}) {
    const [walletType, setWalletType] = useState("Issuer");
    const [walletName, setWalletName] = useState("ISSUER");

    useEffect(() => {
        if (walletType === "Issuer") {
            setWalletName("ISSUER");
        } else if (walletType === "Standby") {
            setWalletName("STANDBY");
        } else {
            setWalletName("");
        }
    }, [walletType]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!walletName) return;
        onSubmit(walletType, walletName);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96">
                <h2 className="text-xl font-bold mb-4">Create Wallet</h2>

                <form onSubmit={handleSubmit}>
                    {/* Wallet Type */}
                    <div className="mb-4">
                        <label className="block text-gray-700 mb-1">Wallet Type</label>
                        <select
                            value={walletType}
                            onChange={(e) => setWalletType(e.target.value)}
                            className="w-full border border-gray-300 rounded p-2"
                        >
                            <option value="Issuer">Issuer</option>
                            <option value="Standby">Standby</option>
                            <option value="Operational">Operational</option>
                        </select>
                    </div>

                    {/* Wallet Name */}
                    <div className="mb-4">
                        <label className="block text-gray-700 mb-1">Wallet Name</label>
                        <input
                            type="text"
                            value={walletName}
                            onChange={(e) => {
                                const v = e.target.value.toUpperCase();
                                if (/^[A-Z]*$/.test(v)) setWalletName(v);
                            }}
                            disabled={walletType === "Issuer" || walletType === "Standby"}
                            className="w-full border border-gray-300 rounded p-2"
                            placeholder="Enter wallet name"
                        />
                    </div>

                    <div className="flex justify-end space-x-2">
                        <Button variant="cancel" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="submit" disabled={loading}>
                            {loading ? "Creating..." : "Add Wallet"}
                        </Button>
                    </div>
                </form>

                {/* ErrorModal now uses the real onErrorClose */}
                {errorMessage && (
                    <ErrorModal
                        errorMessage={errorMessage}
                        onClose={onErrorClose}
                    />
                )}

                {/* SuccessModal now uses the real onSuccessClose */}
                {successMessage && (
                    <SuccessModal
                        successMessage={successMessage}
                        onClose={onSuccessClose}
                    />
                )}
            </div>
        </div>
    );
}
