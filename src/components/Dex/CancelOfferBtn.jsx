"use client";

import { useState } from "react";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import PasswordConfirmMdl from "../PasswordConfirmMdl";
import { Trash2 } from "lucide-react";

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
          userWallet: wallet,
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
}
