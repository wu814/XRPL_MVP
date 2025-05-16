"use client";

// Change this file when there are more than 1 issuer wallet

import React, { useState } from "react";
import Button from "./Button";
import ErrorModal from "./ErrorMdl";
import SuccessModal from "./SuccessMdl";
import CurrencyDropDown from "./CurrencyDropDown";
import { setTrustline } from "@/utils/xrpl/setTrustline";

export default function SetTrustlineBtn({
  setterWallet,
  issuerWallets,
}) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // for Standby wallets
  const [currency, setCurrency] = useState("");
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);

  // Centralized request routine
  const doRequest = async (selectedCurrency) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await setTrustline(
        setterWallet,
        issuerWallets,
        selectedCurrency,
      );
      
      setSuccessMessage(res);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
      setShowCurrencyModal(false);
    }
  };

  // Entry point when the user clicks the main button
  const handleClick = () => {
    setCurrency("");
    setShowCurrencyModal(true);
  };

  return (
    <>
      <Button variant="primary" onClick={handleClick} disabled={loading}>
        {loading ? "Setting..." : "Set Trustline"}
      </Button>

      {showCurrencyModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/10">
          <div className="w-96 space-y-4 rounded-lg bg-[#3F4359] p-6 shadow-lg">
            <h2 className="text-center text-lg font-semibold">
              Select Currency
            </h2>
            <CurrencyDropDown
              value={currency}
              onChange={setCurrency}
              disabledOptions={["XRP"]}
            />
            <div className="flex justify-end space-x-2">
              <Button
                variant="cancel"
                onClick={() => setShowCurrencyModal(false)}
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
            setShowCurrencyModal(false);
          }}
        />
      )}
    </>
  );
}
