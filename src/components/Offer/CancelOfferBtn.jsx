"use client";

import { useState } from "react";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import PasswordConfirmMdl from "../PasswordConfirmMdl";

export default function CancelOfferBtn({
  wallet,
  offerSequence,
  onOfferCanceled,
}) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleCancelOffer = async () => {
    if (!wallet || !offerSequence) return;
    setLoading(true);
    try {
      const res = await fetch("/api/offers/cancelOffer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletSeed: wallet.seed,
          offerSequence,
          enteredPassword,
        }),
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setSuccessMessage(result.message || "Offer canceled successfully.");
      } else {
        setErrorMessage(`Failed to cancel offer: ${result.error}`);
      }
    } catch (error) {
      setErrorMessage(`Error canceling offer: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute right-2">
      <button
        disabled={loading}
        onClick={() => setShowConfirm(true)}
        className="transition hover:scale-110"
      >
        <svg
          className="h-5 w-5 text-cancel"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M5 7h14m-9 3v8m4-8v8M10 3h4a1 1 0 0 1 1 1v3H9V4a1 1 0 0 1 1-1ZM6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Z"
          />
        </svg>
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
}
