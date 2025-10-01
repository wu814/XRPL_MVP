"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
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
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleDeepFreeze = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      // TODO: Implement API call to /api/wallet/deepFreeze
      // const res = await fetch("/api/wallet/deepFreeze", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ issuerWallet, targetAddress, currency }),
      // });

      // if (!res.ok) {
      //   const errorData: APIResponse<never> = await res.json();
      //   setErrorMessage(errorData.message);
      //   setLoading(false);
      //   return;
      // }
      // const result: APIResponse<never> = await res.json();

      // Placeholder success message
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setSuccessMessage("Deep freeze will be implemented soon");
      
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
        Deep Freeze
      </Button>

      {showMdl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="w-96 rounded-lg bg-color3 p-6">
            <h2 className="mb-4 text-2xl font-semibold">
              Deep Freeze Account
            </h2>
            
            <label className="text-sm text-mutedText">
              Currency
            </label>
            <CurrencyDropDown
              value={currency}
              onChange={setCurrency}
              className="mb-4"
            />
            
            <label className="text-sm text-mutedText">
              Target Wallet Address
            </label>
            <input
              type="text"
              value={targetAddress}
              onChange={(e) => setTargetAddress(e.target.value)}
              className="bg-color4 mt-1 w-full rounded-lg border border-transparent p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
              placeholder="Enter wallet address to deep freeze"
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
                onClick={handleDeepFreeze}
                disabled={loading || !targetAddress || !currency}
                className="flex-1"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  "Deep Freeze"
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
