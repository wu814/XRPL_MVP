"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Button from "../Button";
import CreateAmmMdl from "./CreateAmmMdl";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import { useIssuerWallet } from "@/components/Wallet/IssuerWalletProvider";
import { YONAWallet } from "@/types/wallet";

interface TreasuryWalletData {
  classic_address: string;
  wallet_type: string;
}

interface CreateAmmResponse {
  data?: any;
  message?: string;
  error?: string;
}

interface TreasuryResponse {
  data: TreasuryWalletData[];
}

interface CreateAmmBtnProps {
  onAmmCreated?: (data: any) => void;
}

export default function CreateAmmBtn({ onAmmCreated }: CreateAmmBtnProps) {
  const { data: session, status } = useSession();
  const [showMdl, setShowMdl] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [treasuryWallet, setTreasuryWallet] = useState<YONAWallet | null>(null);
  const { issuerWallets } = useIssuerWallet();
  
  // Persisted form state
  const [assetA, setAssetA] = useState<string>("");
  const [assetB, setAssetB] = useState<string>("");
  const [amountA, setAmountA] = useState<string>("");
  const [amountB, setAmountB] = useState<string>("");
  const [fee, setFee] = useState<string>("0");

  const fetchTreasuryWallet = async () => {
    try {
      const res = await fetch("/api/wallet/getTreasuryWallet");
      const result: TreasuryResponse = await res.json();
      if (Array.isArray(result.data) && result.data.length > 0) {
        const wallet = result.data[0];
        const treasuryWalletData: YONAWallet = {
          classicAddress: wallet.classic_address,
          walletType: wallet.wallet_type,
        };
        setTreasuryWallet(treasuryWalletData);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
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
      const res = await fetch("/api/amm/createAmm", {
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
      const result: CreateAmmResponse = await res.json();
      if (!res.ok) throw new Error(result.error || "AMM creation failed");
      if (onAmmCreated) onAmmCreated(result.data);
      setSuccessMessage(result.message || "AMM created successfully");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
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
};
