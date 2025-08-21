"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Button from "../Button";
import CreateAMMMdl from "./CreateAMMMdl";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import { useIssuerWallet } from "@/components/wallet/IssuerWalletProvider";
import { YONAWallet } from "@/types/appTypes";
import { APIErrorResponse } from "@/types/api/errorAPITypes";
import { GetTreasuryWalletAPIResponse } from "@/types/api/walletAPITypes";
import { CreateAMMAPIResponse } from "@/types/api/ammAPITypes";

interface CreateAMMBtnProps {
  onAMMCreated?: (data: any) => void;
}

export default function CreateAMMBtn({ onAMMCreated }: CreateAMMBtnProps) {
  const { data: session, status } = useSession();
  const [showMdl, setShowMdl] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [treasuryWallet, setTreasuryWallet] = useState<YONAWallet | null>(null);
  const { issuerWallets } = useIssuerWallet();
  
  // Persisted form state
  const [currency1, setCurrency1] = useState<string>("");
  const [currency2, setCurrency2] = useState<string>("");
  const [value1, setValue1] = useState<number | null>(null);
  const [value2, setValue2] = useState<number | null>(null);
  const [tradingFee, setTradingFee] = useState<number | null>(null);

  const fetchTreasuryWallet = async () => {
    try {
      const response = await fetch("/api/wallet/getTreasuryWallet");
      const result: GetTreasuryWalletAPIResponse = await response.json();
      if (!response.ok) {
        const errorData: APIErrorResponse = await response.json();
        setErrorMessage(errorData.message);
        return;
      }
      setTreasuryWallet(result.data);
    } catch (error: any) {
      setErrorMessage(error.message);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "ADMIN") {
      fetchTreasuryWallet();
    }
  }, [status, session]);

  const handleCreateAMM = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/amm/createAMM", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treasuryWallet,
          issuerWallets,
          currency1,
          value1,
          currency2,
          value2,
          tradingFee,
        }),
      });
      if (!response.ok) {
        const errorData: APIErrorResponse = await response.json();
        setErrorMessage(errorData.message);
        setLoading(false);
        return;
      }
      const result: CreateAMMAPIResponse = await response.json();
      onAMMCreated(result.data);
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
        <CreateAMMMdl
          onClose={() => setShowMdl(false)}
          onSubmit={handleCreateAMM}
          loading={loading}
          currency1={currency1}
          setCurrency1={setCurrency1}
          currency2={currency2}
          setCurrency2={setCurrency2}
          value1={value1}
          setValue1={setValue1}
          value2={value2}
          setValue2={setValue2}
          tradingFee={tradingFee}
          setTradingFee={setTradingFee}
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
