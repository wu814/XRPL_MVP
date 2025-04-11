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
  const [walletName, setWalletName] = useState("USD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // In a real app, call your XRPL wallet generation function here.
      // For demonstration, we simulate a generated wallet object.
      const walletData = {
        classic_address: "rEXAMPLE",
        wallet_type: walletType,
        seed: "sEXAMPLE",
        xrp_balance: 100, // Replace with actual funded balance
        last_sequence: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Call your POST API endpoint to add the wallet.
      const res = await fetch("/api/wallets", {
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
      // Notify parent with new wallet data.
      onWalletCreated(result.data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    // Popup Overlay
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      {/* Popup Box */}
      <div className="bg-white p-6 rounded-lg shadow-lg w-96">
        <h2 className="text-xl font-bold mb-4">Create Wallet</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-1">
              Wallet Type
            </label>
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
          <div className="mb-4">
            <label className="block text-gray-700 mb-1">
              Wallet Name (Currency)
            </label>
            <select
              value={walletName}
              onChange={(e) => setWalletName(e.target.value)}
              className="w-full border border-gray-300 rounded p-2"
            >
              {currencyOptions.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-red-500 mb-4">{error}</p>}
          <div className="flex justify-end space-x-2">
            <Button
              variant="cancel"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              variant="submit"
              disabled={loading}
            >
              {loading ? "Creating..." : "Add Wallet"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
