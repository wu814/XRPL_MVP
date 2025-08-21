"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import CurrencyDropDown from "../currency/CurrencyDropDown";
import Button from "../Button";
import SuccessMdl from "../SuccessMdl";
import ErrorMdl from "../ErrorMdl";
import { YONAWallet } from "@/types/appTypes";

interface ClawbackResponse {
  message?: string;
  error?: string;
}

interface ClawbackTokenBtnProps {
  issuerWallet: YONAWallet;
}

export default function ClawbackTokenBtn({ issuerWallet }: ClawbackTokenBtnProps) {
  const [showModal, setShowModal] = useState<boolean>(false);
  const [targetAccountAddress, setTargetAccountAddress] = useState<string>("");
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const handleClawback = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/transaction/clawbackToken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issuerWallet,
          targetAccountAddress,
          currency: selectedCurrency,
          amount,
        }),
      });

      const result: ClawbackResponse = await res.json();
      if (!res.ok) throw new Error(result.error || "Unknown error");

      setSuccessMessage(
        `Successfully clawed back ${amount} ${selectedCurrency}`,
      );
      setShowModal(false);
      setTargetAccountAddress("");
      setSelectedCurrency(null);
      setAmount("");
    } catch (error: any) {
      setErrorMessage(`Failed to clawback: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="primary" onClick={() => setShowModal(true)}>
        Clawback
      </Button>

      {showModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="w-96 space-y-4 rounded-lg bg-color3 p-6">
            <h2 className="text-2xl font-semibold">
              Clawback Token
            </h2>

            <div>
              <label className="block text-sm font-medium text-mutedText">
                Target Account Address
              </label>
              <input
                type="text"
                value={targetAccountAddress}
                onChange={(e) => setTargetAccountAddress(e.target.value)}
                className="bg-color4 mt-1 w-full rounded-lg border border-transparent p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
                placeholder="Enter target wallet address..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-mutedText">
                Currency
              </label>
              <CurrencyDropDown
                value={selectedCurrency || ""}
                onChange={setSelectedCurrency}
                disabledOptions={[]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-mutedText">
                Amount
              </label>
              <input
                type="number"
                step="0.000001"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-color4 mt-1 w-full rounded-lg border border-transparent p-2 hover:border-primary focus:border-primary focus:outline-none"
                placeholder="Enter amount to claw back..."
              />
            </div>

            <div className="flex space-x-2">
              <Button
                variant="cancel"
                onClick={() => setShowModal(false)}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleClawback}
                disabled={
                  !targetAccountAddress ||
                  !selectedCurrency ||
                  !amount ||
                  loading
                }
                className="flex-1"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Processing...
                  </div>
                ) : (
                  "Clawback"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setErrorMessage("")}
        />
      )}
      {successMessage && (
        <SuccessMdl
          successMessage={successMessage}
          onClose={() => setSuccessMessage("")}
        />
      )}
    </>
  );
};
