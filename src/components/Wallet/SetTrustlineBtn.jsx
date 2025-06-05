"use client";

// Change this file when there are more than 1 issuer wallet

import React, { useState } from "react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import CurrencyDropDown from "../Currency/CurrencyDropDown";

export default function SetTrustlineBtn({ setterWallet, issuerWallets }) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // for Standby wallets
  const [currency, setCurrency] = useState("");
  const [showCurrencyMdl, setShowCurrencyMdl] = useState(false);

  // Centralized request routine
  const doRequest = async (selectedCurrency) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/trustlines/setWalletTrustline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setterWallet,
          issuerWallets,
          currency: selectedCurrency,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to set trustline");

      setSuccessMessage(result.message);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
      setShowCurrencyMdl(false);
    }
  };

  const handleClick = () => {
    setCurrency("");
    setShowCurrencyMdl(true);
  };

  return (
    <>
      <Button variant="primary" onClick={handleClick} disabled={loading}>
        {loading ? "Setting..." : "Set Trustline"}
      </Button>

      {showCurrencyMdl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/10">
          <div className="w-96 space-y-4 rounded-lg bg-color5 p-6">
            <h2 className="text-center text-lg font-semibold">
              Select Currency
            </h2>
            <CurrencyDropDown
              value={currency}
              onChange={setCurrency}
              disabledOptions={["XRP"]}
              dropdownBg="bg-color5"
            />
            <div className="flex justify-end space-x-2">
              <Button
                variant="cancel"
                onClick={() => setShowCurrencyMdl(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => doRequest(currency)}
                disabled={loading || !currency}
              >
                {loading ? "Setting..." : "Set Trustline"}
              </Button>
            </div>
          </div>
        </div>
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
            setShowCurrencyMdl(false);
          }}
        />
      )}
    </>
  );
}
