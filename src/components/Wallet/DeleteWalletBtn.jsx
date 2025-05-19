"use client";

import React, { useState, useEffect } from "react";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import PasswordConfirmMdl from "../PasswordConfirmMdl";

export default function DeleteWalletBtn({ classicAddress, onWalletDeleted }) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState("");

  // The actual delete handler
  const handleDelete = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/wallets/deleteWallet", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ classicAddress, enteredPassword }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to delete wallet");
      }
      setSuccessMessage(result.message);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
      setEnteredPassword("");
    }
  };

  return (
    <div>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={loading}
        className="absolute top-2 right-3 transition duration-200 ease-in-out hover:scale-110"
      >
        <svg
          className="h-7 w-7 text-[#FAFDB8]"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
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
          onConfirm={handleDelete}
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
            onWalletDeleted(classicAddress);
          }}
        />
      )}
    </div>
  );
}
