"use client";

import React, { useState } from "react";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import PasswordConfirmMdl from "../PasswordConfirmMdl";
import { Trash2 } from "lucide-react";
import { YONAWallet } from "@/types/appTypes";
import { APIResponse } from "@/types/apiTypes";


interface CancelOfferBtnProps {
  wallet: YONAWallet;
  offerSequence: number | string;
  onOfferCanceled?: () => void;
}

export default function CancelOfferBtn({
  wallet,
  offerSequence,
  onOfferCanceled,
}: CancelOfferBtnProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [enteredPassword, setEnteredPassword] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleCancelOffer = async () => {
    if (!wallet || !offerSequence) return;
    setLoading(true);
    try {
      const res = await fetch("/api/dex/cancelOffer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userWallet: wallet,
          offerSequence,
          enteredPassword,
        }),
      });

      if (!res.ok) {
        const errorData: APIResponse<never> = await res.json();
        setErrorMessage(errorData.message);
        setLoading(false);
        return;
      }

      const result: APIResponse<never> = await res.json();
      if (result.success) {
        setSuccessMessage(result.message || "Offer canceled successfully.");
      } else {
        setErrorMessage(`Failed to cancel offer: ${result.message}`);
      }
    } catch (error) {
      setErrorMessage(`Error canceling offer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="">
      <button
        disabled={loading}
        onClick={() => setShowConfirm(true)}
        className="transition hover:scale-110"
      >
        <Trash2 className="h-5 w-5 text-cancel" />
      </button>

      {showConfirm && (
        <PasswordConfirmMdl
          onClose={() => setShowConfirm(false)}
          onConfirm={handleCancelOffer}
          loading={loading}
          passwordValue={enteredPassword}
          setPasswordValue={setEnteredPassword}
        />
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
            setShowConfirm(false);
            onOfferCanceled?.();
          }}
        />
      )}
    </div>
  );
};
