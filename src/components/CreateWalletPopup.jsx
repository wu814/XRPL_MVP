"use client";

import React, { useState } from "react";
import Button from "./Button";
import { client, connectXrplClient } from "@/utils/xrpl/testnet";
import * as xrpl from "xrpl";

export default function CreateWalletPopup({ onClose, onWalletCreated }) {
    const [walletType, setWalletType] = useState("Issuer");
    const [walletName, setWalletName] = useState("ISSUER");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // When walletType changes, update walletName accordingly for Issuer & Standby.
    const handleWalletTypeChange = (e) => {
        const newType = e.target.value;
        setWalletType(newType);

        if (newType === "Issuer") {
            setWalletName("ISSUER");
        } else if (newType === "Standby") {
            setWalletName("STANDBY");
        } else {
            // For other wallet types, allow the user to type in a value.
            setWalletName(""); // Clear the field so they can input their own wallet name.
        }
    };

    // Allow the user to change walletName only when walletType is not Issuer or Standby.
    const handleWalletNameChange = (e) => {
        setWalletName(e.target.value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Generate a new wallet using xrpl library
            await connectXrplClient();
            const fund_result = await client.fundWallet();
            const wallet = fund_result.wallet;
            const accountInfo = await client.request({
                command: 'account_info',
                account: wallet.address,
                ledger_index: 'validated'
              });

            const walletData = {
                classic_address: wallet.address,
                wallet_type: walletType,
                wallet_name: walletName,
                seed: wallet.seed,
                xrp_balance: xrpl.dropsToXrp(accountInfo.result.account_data.Balance),
                last_sequence: accountInfo.result.account_data.Sequence,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            console.log("Wallet Data:", walletData);

            const res = await fetch("/api/wallets/createWallet", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(walletData),
            });

            const result = await res.json();
            if (!res.ok) {
                throw new Error(result.error || "Failed to add wallet");
            }
            onWalletCreated(result.data);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        // Popup Overlay with a semi-transparent background
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50">
            {/* Popup Box */}
            <div className="bg-white p-6 rounded-lg shadow-lg w-96">
                <h2 className="text-xl font-bold mb-4">Create Wallet</h2>
                <form onSubmit={handleSubmit}>
                    {/* Wallet Type Dropdown */}
                    <div className="mb-4">
                        <label className="block text-gray-700 mb-1">Wallet Type</label>
                        <select
                            value={walletType}
                            onChange={handleWalletTypeChange}
                            className="w-full border border-gray-300 rounded p-2"
                        >
                            <option value="Issuer">Issuer</option>
                            <option value="Standby">Standby</option>
                            <option value="Operational">Operational</option>
                        </select>
                    </div>

                    {/* Wallet Name Input */}
                    <div className="mb-4">
                        <label className="block text-gray-700 mb-1">Wallet Name</label>
                        <input
                            type="text"
                            value={walletName}
                            onChange={handleWalletNameChange}
                            className="w-full border border-gray-300 rounded p-2"
                            // Disable the input if walletType is Issuer or Standby.
                            disabled={walletType === "Issuer" || walletType === "Standby"}
                            placeholder="Enter wallet name"
                        />
                    </div>

                    {error && <p className="text-red-500 mb-4">{error}</p>}

                    <div className="flex justify-end space-x-2">
                        <Button variant="cancel" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button variant="submit" disabled={loading}>
                            {loading ? "Creating..." : "Add Wallet"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
