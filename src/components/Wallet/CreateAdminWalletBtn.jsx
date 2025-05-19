"use client";

import React, { useState } from "react";
import Button from "../Button";
import CreateAdminWalletMdl from "./CreateAdminWalletMdl";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";

export default function CreateAdminWalletBtn({ onWalletCreated }) {
  const [showMdl, setShowMdl] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleCreateWallet = async (walletType) => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/wallets/createWallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletType }),
      }); 
      const result = await res.json();  
      if (!res.ok) throw new Error(result.error || "Failed to add wallet");
      if (onWalletCreated) onWalletCreated(result.data);
      setSuccessMessage(result.message);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button
        variant="primary"
        onClick={() => setShowMdl(true)}
        className="mt-4 w-full"
      >
        + Create Wallet
      </Button>

      {showMdl && (
        <CreateAdminWalletMdl
          onClose={() => setShowMdl(false)}
          onSubmit={handleCreateWallet}
          loading={loading}
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
            setShowMdl(false);
          }}
        />
      )}
    </div>
  );
}
