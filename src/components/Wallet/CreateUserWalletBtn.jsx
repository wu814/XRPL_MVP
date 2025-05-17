"use client";
// Change this file when there are more than 1 issuer wallet

import React, { useState } from "react";
import Button from "../Button";
import CreateUserWalletModal from "./CreateUserWalletMdl";
import ErrorModal from "../ErrorMdl";
import SuccessModal from "../SuccessMdl";
import { createWallet } from "@/utils/xrpl/createWallet";

export default function CreateUserWalletBtn({ onWalletCreated }) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);


  const handleCreateWallet = async (walletType) => {
    setLoading(true);
    setErrorMessage(null);

    let walletData;

    try {
      walletData = await createWallet(walletType);
      
      const res = await fetch("/api/wallets/createWallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(walletData),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to add wallet");
      
      if (onWalletCreated) onWalletCreated(walletData);
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
        onClick={() => setShowModal(true)}
        className="mt-4 w-full hover:scale-none"
      >
        + Create / Import Wallet
      </Button>

      {showModal && (
        <CreateUserWalletModal
          onClose={() => setShowModal(false)}
          onSubmit={handleCreateWallet}
          loading={loading}
        />
      )}

      {errorMessage && (
        <ErrorModal
          errorMessage={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}

      {successMessage && (
        <SuccessModal
          successMessage={successMessage}
          onClose={() => {
            setSuccessMessage(null);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
