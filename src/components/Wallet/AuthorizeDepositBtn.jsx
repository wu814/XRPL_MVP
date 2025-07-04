"use client";

import React, { useState } from "react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";

export default function AuthorizeDepositBtn({ treasuryWallet, onSuccess }) {
  const [showMdl, setShowMdl] = useState(false);
  const [authorizedAddress, setAuthorizedAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleAuthorize = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/wallets/authorizeDeposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treasuryWallet, authorizedAddress }),
      });

      const result = await res.json();
      if (!res.ok)
        throw new Error(result.error || "Failed to authorize deposit");

      setSuccessMessage(result.message);
      
      // Call the onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
      setShowMdl(false);
    }
  };

  return (
    <div>
      <Button variant="primary" onClick={() => setShowMdl(true)}>
        Authorize Deposit
      </Button>

      {showMdl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/10">
          <div className="w-96 rounded-lg bg-color4 p-6">
            <h2 className="mb-4 text-2xl text-primary font-semibold">
              Authorize Deposit
            </h2>
            <label className="text-sm text-mutedText">
              Wallet Address
            </label>
            <input
              type="text"
              value={authorizedAddress}
              onChange={(e) => setAuthorizedAddress(e.target.value)}
              className="bg-color6 mt-1 w-full rounded-lg border border-transparent p-2 hover:border-primary focus:border-primary focus:outline-none"
              placeholder="Enter wallet address to authorize"
            />
            <div className="mt-4 flex space-x-2">
              <Button
                variant="cancel"
                onClick={() => setShowMdl(false)}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleAuthorize}
                disabled={loading || !authorizedAddress}
                className="flex-1"
              >
                {loading ? "Authorizing..." : "Authorize"}
              </Button>
            </div>
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
          onClose={() => setSuccessMessage(null)}
        />
      )}
    </div>
  );
}
