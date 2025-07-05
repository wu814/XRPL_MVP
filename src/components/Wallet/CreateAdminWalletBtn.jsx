"use client";

import React, { useState } from "react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import { on } from "events";

export default function CreateAdminWalletBtn({ onWalletCreated }) {
  const [showMdl, setShowMdl] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [walletType, setWalletType] = useState("ISSUER");

  const handleCreateWallet = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/wallets/createWallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletType }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to add wallet");

      setSuccessMessage(result.message);

      // Background call to set wallet flags
      setTimeout(async () => {
        try {
          const flagRes = await fetch("/api/wallets/setWalletFlags", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet: result.data }),
          });
          const flagResult = await flagRes.json();
          if (!flagRes.ok) {
            throw new Error(`setWalletFlags failed: ${flagResult.error}`);
          } else {
            console.log("✅ Flags set:", flagResult.message);
          }
        } catch (e) {
          setErrorMessage(e.message);
        }
      }, 0);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleCreateWallet();
  };

  return (
    <div>
      <Button
        variant="primary"
        onClick={() => setShowMdl(true)}
        className="mt-4 w-full"
      >
        + Create Wallet
      </Button>

      {showMdl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="w-96 rounded-lg bg-color4 p-6">
            <h2 className="mb-4 text-xl font-bold">Create Wallet</h2>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="text-mutedText">Wallet Type</label>
                <select
                  value={walletType}
                  onChange={(e) => setWalletType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-transparent bg-color5 p-2 focus:border-primary focus:outline-none hover:border-primary"
                >
                  <option value="ISSUER">Issuer</option>
                  <option value="STANDBY TREASURY">Standby Treasury</option>
                  <option value="STANDBY PATHFIND">Standby Pathfind</option>
                </select>
              </div>

              <div className="flex space-x-2">
                <Button
                  variant="cancel"
                  onClick={() => setShowMdl(false)}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={loading} className="flex-1">
                  {loading ? "Creating..." : "Add Wallet"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {errorMessage && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}

      {successMessage && (
        <SuccessMdl
          successMessage={successMessage}
          onClose={() => {
            setSuccessMessage(null);
            onWalletCreated(); // Notify parent component
            setShowMdl(false); // Close modal after success
          }}
        />
      )}
    </div>
  );
}
