"use client";

import { useState } from "react";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import PasswordConfirmMdl from "../PasswordConfirmMdl";
import { Trash2 } from "lucide-react";

interface DeleteWalletResponse {
  message?: string;
  error?: string;
}

interface DeleteWalletBtnProps {
  classicAddress: string;
  onWalletDeleted: (classicAddress: string) => void;
}

export default function DeleteWalletBtn({ classicAddress, onWalletDeleted }: DeleteWalletBtnProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [enteredPassword, setEnteredPassword] = useState<string>("");

  // The actual delete handler
  const handleDelete = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/wallet/deleteWallet", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ classicAddress, enteredPassword }),
      });

      const result: DeleteWalletResponse = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to delete wallet");
      }
      setSuccessMessage(result.message || "Wallet deleted successfully");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
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
        className="absolute right-2 top-2 transition duration-200 ease-in-out hover:scale-110"
      >
        <Trash2 className="w-6 h-6 text-cancel" />
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
            setShowConfirm(false);
          }}
        />
      )}
    </div>
  );
};
