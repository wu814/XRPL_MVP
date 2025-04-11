"use client";

import React, { useState } from "react";
import Button from "./Button";

/**
 * A Popup for creating a new wallet.
 *
 * Props:
 * - onClose: function to call when the Popup should close.
 * - onWalletCreated: function to call with the new wallet data when created.
 */
export default function CreateWalletPopup({ onClose, onWalletCreated }) {
  const [walletType, setWalletType] = useState("Issuer");
  const currencyOptions = ["BTC", "CAD", "ETH", "EUR", "MXN", "USD"].sort();
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
      // For other wallet types, you can choose to allow the user to select from the drop down.
      // Here we default to the first option from the sorted list.
      setWalletName(currencyOptions[0]);
    }
  };

  // Allow walletName to change only if walletType is not Issuer or Standby.
  const handleWalletNameChange = (e) => {
    setWalletName(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const walletData = {
        classic_address: "rEXAMPLE2", // Replace with actual generated address.
        wallet_type: walletType,
        wallet_name: walletName,
        seed: "sEXAMPLE",
        xrp_balance: 100, // Replace with actual funded balance.
        last_sequence: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log("Generated wallet data:", walletData);

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
    // Popup Overlay with a semi-transparent grey background
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50">
      {/* Popup Box */}
      <div className="bg-white p-6 rounded-lg shadow-lg w-96">
        <h2 className="text-xl font-bold mb-4">Create Wallet</h2>
        <form onSubmit={handleSubmit}>
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
          <div className="mb-4">
            <label className="block text-gray-700 mb-1">
              Wallet Name
            </label>
            <select
              value={walletName}
              onChange={handleWalletNameChange}
              className="w-full border border-gray-300 rounded p-2"
              // Disable if walletType is Issuer or Standby
              //disabled={walletType === "Issuer" || walletType === "Standby"}
            >
              {walletType === "Issuer" || walletType === "Standby" ? (
                // If disabled, show only the preset value.
                <option value={walletName} className="text-lg">{walletName}</option>
              ) : (
                currencyOptions.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))
              )}
            </select>
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
