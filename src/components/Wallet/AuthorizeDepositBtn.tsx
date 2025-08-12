"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";

interface TreasuryWallet {
  classicAddress: string;
  walletType?: string;
}

interface AuthorizeDepositResponse {
  message?: string;
  error?: string;
}

interface AuthorizeDepositBtnProps {
  treasuryWallet: TreasuryWallet;
  onSuccess?: () => void;
}

export default function AuthorizeDepositBtn({ treasuryWallet, onSuccess }: AuthorizeDepositBtnProps) {
  const [showMdl, setShowMdl] = useState<boolean>(false);
  const [authorizedAddress, setAuthorizedAddress] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAuthorize = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/wallet/authorizeDeposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletWithDepositAuth: treasuryWallet, authorizedAddress }),
      });

      const result: AuthorizeDepositResponse = await res.json();
      if (!res.ok)
        throw new Error(result.error || "Failed to authorize deposit");

      setSuccessMessage(result.message || "Deposit authorized successfully");
      
      // Call the onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
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
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="w-96 rounded-lg bg-color3 p-6">
            <h2 className="mb-4 text-2xl font-semibold">
              Authorize Deposit
            </h2>
            <label className="text-sm text-mutedText">
              Wallet Address
            </label>
            <input
              type="text"
              value={authorizedAddress}
              onChange={(e) => setAuthorizedAddress(e.target.value)}
              className="bg-color4 mt-1 w-full rounded-lg border border-transparent p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
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
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Authorizing...</span>
                  </div>
                ) : (
                  "Authorize"
                )}
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
};
