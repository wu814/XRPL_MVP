"use client";

import React, { useState } from "react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";

export default function CreateUserWalletBtn({ onWalletCreated }) {
  const [showMdl, setShowMdl] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [method, setMethod] = useState("custodial");

  const handleCreateWallet = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/wallets/createWallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletType: "USER" }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to add wallet");

      setSuccessMessage(result.message);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (method === "custodial") {
      handleCreateWallet();
    }
  };

  return (
    <div>
      <Button
        variant="primary"
        onClick={() => setShowMdl(true)}
        className="hover:scale-none mt-4 w-full"
      >
        + Create / Import Wallet
      </Button>

      {showMdl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/10">
          <div className="w-96 rounded-lg bg-color4 p-6">
            <h2 className="mb-4 text-xl font-bold">Create / Import Wallet</h2>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="text-mutedText">Wallet Type</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-transparent bg-color5 p-2 focus:border-primary focus:outline-none hover:border-primary"
                >
                  <option value="custodial">Custodial Wallet</option>
                  <option value="import">Import Non-Custodial Wallet</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="cancel"
                  onClick={() => setShowMdl(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading || method !== "custodial"}
                >
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
            setShowMdl(false);
          }}
        />
      )}
    </div>
  );
}
