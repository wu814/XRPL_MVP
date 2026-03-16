"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Button from "../app/Button";
import ErrorMdl from "../app/ErrorMdl";
import SuccessMdl from "../app/SuccessMdl";
import CurrencyDropDown from "../currency/CurrencyDropDown";
import { APIResponse } from "@/types/apiTypes";
import { YONAWallet } from "@/types/appTypes";

interface DeepFreezeBtnProps {
  issuerWallet: YONAWallet;
  onSuccess?: () => void;
}

export default function DeepFreezeBtn({ issuerWallet, onSuccess }: DeepFreezeBtnProps) {
  const [showMdl, setShowMdl] = useState<boolean>(false);
  const [targetAddress, setTargetAddress] = useState<string>("");
  const [currency, setCurrency] = useState<string>("");
  const [action, setAction] = useState<"freeze" | "unfreeze">("freeze");
  const [includeDeepFreeze, setIncludeDeepFreeze] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleFreeze = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/wallet/deepFreezeTrustline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          issuerWallet, 
          trustlineAddress: targetAddress,
          currency,
          action,
          includeDeepFreeze: action === "freeze" ? includeDeepFreeze : undefined,
        }),
      });

      if (!res.ok) {
        const errorData: APIResponse<never> = await res.json();
        setErrorMessage(errorData.message);
        setLoading(false);
        return;
      }
      const result: APIResponse<never> = await res.json();

      const freezeType = includeDeepFreeze && action === "freeze" ? "freeze and deep freeze" : action === "freeze" ? "freeze" : "unfreeze";
      setSuccessMessage(result.message || `Successfully applied ${freezeType}`);
      
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
        Freeze
      </Button>

      {showMdl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="w-96 rounded-lg bg-color3 p-6">
            <h2 className="mb-4 text-2xl font-semibold">
              Freeze Trustline
            </h2>
            
            {/* Action Selection */}
            <label className="text-sm text-mutedText">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as "freeze" | "unfreeze")}
              className="bg-color4 mt-1 w-full rounded-lg border border-transparent p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
            >
              <option value="freeze">Apply Freeze</option>
              <option value="unfreeze">Clear Freeze</option>
            </select>

            {/* Target Address */}
            <label className="mt-4 block text-sm text-mutedText">
              Target Wallet Address
            </label>
            <input
              type="text"
              value={targetAddress}
              onChange={(e) => setTargetAddress(e.target.value)}
              className="bg-color4 mt-1 w-full rounded-lg border border-transparent p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
              placeholder="Enter wallet address"
            />

            {/* Currency Code */}
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

            {/* Include Deep Freeze Checkbox (only for freeze action) */}
            {action === "freeze" && (
              <div className="mt-4 flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="includeDeepFreeze"
                  checked={includeDeepFreeze}
                  onChange={(e) => setIncludeDeepFreeze(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="includeDeepFreeze" className="text-sm text-mutedText">
                  Include deep freeze (blocks receiving too)
                </label>
              </div>
            )}

            {/* Info Text */}
            <div className="mt-4 rounded-lg bg-color4 p-3 text-xs text-gray-400">
              {action === "freeze" ? (
                <>
                  <strong className="text-orange-400">Freeze:</strong> Prevents sending tokens to others.
                  {includeDeepFreeze && (
                    <>
                      <br />
                      <strong className="text-red-400">Deep Freeze:</strong> Also blocks receiving tokens (except from issuer).
                    </>
                  )}
                </>
              ) : (
                <>
                  <strong className="text-blue-400">Note:</strong> This will clear both freeze and deep freeze from the trustline.
                </>
              )}
            </div>

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
                onClick={handleFreeze}
                disabled={loading || !targetAddress || !currency}
                className="flex-1"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  action === "freeze" ? "Apply Freeze" : "Clear Freeze"
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
