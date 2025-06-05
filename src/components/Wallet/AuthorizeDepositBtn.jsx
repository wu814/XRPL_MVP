"use client";

import React, { useState } from "react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";

export default function AuthorizeDepositBtn({ treasuryWallet }) {
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
          <div className="w-96 rounded-lg bg-color5 p-6">
            <h2 className="mb-4 text-center text-xl font-semibold">
              Authorize Deposit
            </h2>
            <label className="text-md font-medium text-mutedText">
              Wallet Address
            </label>
            <input
              type="text"
              value={authorizedAddress}
              onChange={(e) => setAuthorizedAddress(e.target.value)}
              className="bg-color6 mt-1 w-full rounded-lg border border-transparent p-2 hover:border-primary focus:border-primary focus:outline-none"
              placeholder="Enter wallet address to authorize"
            />
            <div className="mt-4 flex justify-end space-x-2">
              <Button
                variant="cancel"
                onClick={() => setShowMdl(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleAuthorize}
                disabled={loading || !authorizedAddress}
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
