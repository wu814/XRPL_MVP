"use client";

import React, { useState } from "react";
import CurrencyDropDown from "../Currency/CurrencyDropDown";
import Button from "../Button";
import SuccessMdl from "../SuccessMdl";
import ErrorMdl from "../ErrorMdl";

export default function ClawbackTokenBtn({ issuerWallet }) {
  const [showModal, setShowModal] = useState(false);
  const [targetAccountAddress, setTargetAccountAddress] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState(null);
  const [amount, setAmount] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleClawback = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/transactions/clawbackToken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issuerWallet,
          targetAccountAddress,
          currency: selectedCurrency,
          amount,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unknown error");

      setSuccessMessage(
        `Successfully clawed back ${amount} ${selectedCurrency}`,
      );
      setShowModal(false);
      setTargetAccountAddress("");
      setSelectedCurrency(null);
      setAmount("");
    } catch (error) {
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
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/10">
          <div className="w-96 space-y-4 rounded-lg bg-color4 p-6">
            <h2 className="text-2xl text-primary font-semibold">
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
                className="bg-color6 mt-1 w-full rounded-lg border border-transparent p-2 hover:border-primary focus:border-primary focus:outline-none"
                placeholder="Enter target wallet address..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-mutedText">
                Currency
              </label>
              <CurrencyDropDown
                value={selectedCurrency}
                onChange={setSelectedCurrency}
                disabledOptions={[]}
                dropdownBg="bg-color6"
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
                className="bg-color6 mt-1 w-full rounded-lg border border-transparent p-2 hover:border-primary focus:border-primary focus:outline-none"
                placeholder="Enter amount to claw back..."
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="cancel"
                onClick={() => setShowModal(false)}
                disabled={loading}
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
              >
                {loading ? "Processing..." : "Clawback"}
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
}
