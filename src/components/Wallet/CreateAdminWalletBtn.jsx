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

    // Notify frontend immediately
    if (onWalletCreated) onWalletCreated(result.data);
    setSuccessMessage(result.message);

    // Background call to set wallet flags
    setTimeout(async () => {
      try {
        const flagRes = await fetch("/api/wallets/setWalletFlags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: result.data }), 
        });
        const flagResult = await flagRes.json();
        if (!flagRes.ok) {
          throw new Error(`setWalletFlags failed: ${flagResult.error}`);
        } else {
          console.log("✅ Flags set:", flagResult.message);
        }
      } catch (e) {
        setErrorMessage(e.message);
      }
    }, 0); // Run this immediately (0s) after everything else in the current call stack is done.

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
