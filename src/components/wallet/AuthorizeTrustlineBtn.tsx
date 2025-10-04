"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import { APIResponse } from "@/types/apiTypes";
import { YONAWallet } from "@/types/appTypes";

interface AuthorizeTrustlineBtnProps {
  issuerWallet: YONAWallet;
  onSuccess?: () => void;
}

export default function AuthorizeTrustlineBtn({ issuerWallet, onSuccess }: AuthorizeTrustlineBtnProps) {
  const [showMdl, setShowMdl] = useState<boolean>(false);
  const [trustlineAddress, setTrustlineAddress] = useState<string>("");
  const [currency, setCurrency] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAuthorizeTrustline = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/wallet/authorizeTrustline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issuerWallet, trustlineAddress, currency }),
      });

      if (!res.ok) {
        const errorData: APIResponse<never> = await res.json();
        setErrorMessage(errorData.message);
        setLoading(false);
        return;
      }
      const result: APIResponse<never> = await res.json();

      setSuccessMessage(result.message || "Trustline authorized successfully");
      
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
        Authorize Trustline
      </Button>

      {showMdl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="w-96 rounded-lg bg-color3 p-6">
            <h2 className="mb-4 text-2xl font-semibold">
              Authorize Trustline
            </h2>
            <label className="text-sm text-mutedText">
              Wallet Address
            </label>
            <input
              type="text"
              value={trustlineAddress}
              onChange={(e) => setTrustlineAddress(e.target.value)}
              className="bg-color4 mt-1 w-full rounded-lg border border-transparent p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
              placeholder="Enter wallet address to authorize"
            />
            <label className="mt-4 block text-sm text-mutedText">
              Currency Code
            </label>
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className="bg-color4 mt-1 w-full rounded-lg border border-transparent p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
              placeholder="Enter currency code (e.g., USD, EUR)"
              maxLength={3}
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
                onClick={handleAuthorizeTrustline}
                disabled={loading || !trustlineAddress || !currency}
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

