"use client";

import { useState } from "react";
import ErrorMdl from "../app/ErrorMdl";
import SuccessMdl from "../app/SuccessMdl";
import PasswordConfirmMdl from "../app/PasswordConfirmMdl";
import { Trash2 } from "lucide-react";
import { APIResponse } from "@/types/apiTypes";

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

      if (!res.ok) {
        const errorData: APIResponse<never> = await res.json();
        setErrorMessage(errorData.message);
        setLoading(false);
        return;
      }
      const result: APIResponse<never> = await res.json();
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
