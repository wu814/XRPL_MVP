"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Button from "../Button";
import CreateAmmMdl from "./CreateAmmMdl";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import { useIssuerWallet } from "@/components/Wallet/IssuerWalletProvider";

class Wallet {
  constructor(classicAddress, walletType) {
    this.classicAddress = classicAddress;
    this.walletType = walletType;
  }
}

export default function CreateAmmBtn({ onAmmCreated }) {
  const { data: session, status } = useSession();
  const [showMdl, setShowMdl] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [treasuryWallet, setTreasuryWallet] = useState(null);
  const { issuerWallets } = useIssuerWallet();
  // Persisted form state
  const [assetA, setAssetA] = useState("");
  const [assetB, setAssetB] = useState("");
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [fee, setFee] = useState("0");

  
  const fetchTreasuryWallet = async () => {
    try {
      const res = await fetch("/api/wallets/getTreasuryWallet");
      const result = await res.json();
      if (Array.isArray(result.data) && result.data.length > 0) {
        const wallet = result.data[0];
        const treasuryWalletData = new Wallet(
          wallet.classic_address,
          wallet.wallet_type,
        );
        setTreasuryWallet(treasuryWalletData);
      }
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "ADMIN") {
      fetchTreasuryWallet();
    }
  }, [status, session]);

  const handleCreateAmm = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/amms/createAmm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treasuryWallet,
          issuerWallets,
          assetA,
          amountA,
          assetB,
          amountB,
          fee,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "AMM creation failed");
      if (onAmmCreated) onAmmCreated(result.data);
      setSuccessMessage(result.message);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button variant="primary" onClick={() => setShowMdl(true)}>
        + Create AMM
      </Button>

      {showMdl && (
        <CreateAmmMdl
          onClose={() => setShowMdl(false)}
          onSubmit={handleCreateAmm}
          loading={loading}
          assetA={assetA}
          setAssetA={setAssetA}
          assetB={assetB}
          setAssetB={setAssetB}
          amountA={amountA}
          setAmountA={setAmountA}
          amountB={amountB}
          setAmountB={setAmountB}
          fee={fee}
          setFee={setFee}
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
